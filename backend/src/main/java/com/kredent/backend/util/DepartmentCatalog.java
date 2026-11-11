package com.kredent.backend.util;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * The fixed set of departments/branches this deployment recognizes — common engineering
 * programmes offered across Indian institutions. Codes are the short form used consistently
 * everywhere (student records, certificates, filters); labels are the full programme name shown
 * in the UI.
 *
 * Deliberately NOT a JPA @Enumerated column type — Student.department and Certificate.department
 * stay plain String columns (no database schema change). This class is the single source of
 * truth both the frontend (via GET /api/admin/departments) and backend validation
 * (isValidCode) use to keep every future value consistent, without requiring a migration for
 * existing free-text rows written before this catalog existed.
 */
public final class DepartmentCatalog {

    public record Department(String code, String label) {}

    private static final List<Department> DEPARTMENTS = List.of(
            new Department("CSE", "Computer Science and Engineering"),
            new Department("ISE", "Information Science and Engineering"),
            new Department("AIML", "Artificial Intelligence and Machine Learning"),
            new Department("CSD", "Computer Science and Design"),
            new Department("CSE_DS", "Computer Science and Engineering (Data Science)"),
            new Department("ECE", "Electronics and Communication Engineering"),
            new Department("EEE", "Electrical and Electronics Engineering"),
            new Department("ME", "Mechanical Engineering"),
            new Department("CE", "Civil Engineering"),
            new Department("ASE", "Aerospace Engineering"),
            new Department("AE", "Aeronautical Engineering"),
            new Department("CHE", "Chemical Engineering")
    );

    private static final Map<String, String> CODE_TO_LABEL;

    static {
        Map<String, String> map = new LinkedHashMap<>();
        for (Department d : DEPARTMENTS) {
            map.put(d.code(), d.label());
        }
        CODE_TO_LABEL = Map.copyOf(map);
    }

    private DepartmentCatalog() {
        // no instances
    }

    public static List<Department> all() {
        return DEPARTMENTS;
    }

    public static boolean isValidCode(String code) {
        return code != null && CODE_TO_LABEL.containsKey(code);
    }

    /** Human-readable label for a code, or the code itself if it's not (or no longer) in the catalog. */
    public static String labelFor(String code) {
        if (code == null) {
            return null;
        }
        return CODE_TO_LABEL.getOrDefault(code, code);
    }
}
