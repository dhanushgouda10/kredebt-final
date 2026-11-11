package com.kredent.backend.config;

import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.DatabaseMetaData;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.mockito.Mockito.times;

class StudentSchemaPatcherTest {

    @Test
    void doesNothingOnNonPostgresDatabases() throws Exception {
        DataSource ds = mock(DataSource.class);
        Connection conn = mock(Connection.class);
        DatabaseMetaData meta = mock(DatabaseMetaData.class);
        when(ds.getConnection()).thenReturn(conn);
        when(conn.getMetaData()).thenReturn(meta);
        when(meta.getDatabaseProductName()).thenReturn("H2");

        new StudentSchemaPatcher(ds).run(null);

        // only the product-name probe was made; no statement was prepared or executed
        verify(conn, times(0)).createStatement();
        verify(conn, times(0)).prepareStatement(org.mockito.ArgumentMatchers.anyString());
    }

    @Test
    void swallowsFailuresSoStartupContinues() throws Exception {
        DataSource ds = mock(DataSource.class);
        when(ds.getConnection()).thenThrow(new java.sql.SQLException("boom"));
        new StudentSchemaPatcher(ds).run(null);
    }
}
