package com.kredent.backend.service;

import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.net.InetSocketAddress;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

class SupabaseStorageServiceTest {

    private HttpServer server;
    private final AtomicInteger calls = new AtomicInteger();

    @BeforeEach
    void start() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    }

    @AfterEach
    void stop() {
        server.stop(0);
    }

    private SupabaseStorageService service() {
        return new SupabaseStorageService("http://127.0.0.1:" + server.getAddress().getPort(), "key", "certificates");
    }

    @Test
    void downloadRetriesAfterADroppedConnection() throws Exception {
        byte[] pdf = "%PDF-1.4 test".getBytes();
        server.createContext("/storage/v1/object/certificates/a/b.pdf", ex -> {
            if (calls.incrementAndGet() == 1) {
                ex.close(); // connection dropped with no response, like a stale pooled connection
                return;
            }
            ex.sendResponseHeaders(200, pdf.length);
            ex.getResponseBody().write(pdf);
            ex.close();
        });
        server.start();

        assertArrayEquals(pdf, service().download("a/b.pdf"));
        assertEquals(2, calls.get());
    }

    @Test
    void unreachableStorageGivesBadGatewayNotAnUnhandledError() {
        server.createContext("/", ex -> ex.close());
        server.start();
        ResponseStatusException e = assertThrows(ResponseStatusException.class, () -> service().download("a/b.pdf"));
        assertEquals(HttpStatus.BAD_GATEWAY, e.getStatusCode());
    }

    @Test
    void uploadRetriesAfterADroppedConnectionAndSendsUpsert() throws Exception {
        java.util.concurrent.atomic.AtomicReference<String> upsert = new java.util.concurrent.atomic.AtomicReference<>();
        server.createContext("/storage/v1/object/certificates/a/c.pdf", ex -> {
            ex.getRequestBody().readAllBytes();
            if (calls.incrementAndGet() == 1) {
                ex.close();
                return;
            }
            upsert.set(ex.getRequestHeaders().getFirst("x-upsert"));
            ex.sendResponseHeaders(200, -1);
            ex.close();
        });
        server.start();
        service().upload("a/c.pdf", "%PDF".getBytes(), "application/pdf");
        assertEquals(2, calls.get());
        assertEquals("true", upsert.get());
    }
}
