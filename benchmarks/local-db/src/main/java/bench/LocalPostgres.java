package bench;

import io.zonky.test.db.postgres.embedded.EmbeddedPostgres;

import java.io.File;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Starts a throwaway PostgreSQL 16 server for benchmarks on 127.0.0.1:54329 and creates the
 * database "kredent_bench" if it doesn't exist. Data persists in benchmarks/.local-db-data/ so the
 * seeded certificates survive a restart; delete that folder to start clean. Stop with Ctrl+C.
 *
 * Local trust authentication: user "postgres", any password. The backend then creates its schema
 * itself through the existing spring.jpa.hibernate.ddl-auto=update setting.
 */
public final class LocalPostgres {

    private static final int PORT = 54329;
    private static final String DATABASE = "kredent_bench";

    public static void main(String[] args) throws Exception {
        File dataDir = new File(System.getProperty("user.dir"), "benchmarks/.local-db-data").getAbsoluteFile();
        if (!dataDir.getParentFile().getName().equals("benchmarks")) {
            throw new IllegalStateException("Run this from the repository root (the folder that contains benchmarks/).");
        }

        EmbeddedPostgres postgres = EmbeddedPostgres.builder()
                .setPort(PORT)
                .setDataDirectory(dataDir)
                .setCleanDataDirectory(false)
                .setServerConfig("listen_addresses", "127.0.0.1")
                .start();

        try (Connection c = postgres.getPostgresDatabase().getConnection();
             Statement s = c.createStatement()) {
            ResultSet rs = s.executeQuery("SELECT 1 FROM pg_database WHERE datname = '" + DATABASE + "'");
            if (!rs.next()) {
                s.execute("CREATE DATABASE " + DATABASE);
            }
        }

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                postgres.close();
            } catch (Exception ignored) {
                // shutting down anyway
            }
        }));

        System.out.println("[local-db] PostgreSQL ready: jdbc:postgresql://127.0.0.1:" + PORT + "/" + DATABASE
                + "  (user postgres, data " + dataDir + ")");
        System.out.println("[local-db] Press Ctrl+C to stop.");
        Thread.currentThread().join();
    }
}
