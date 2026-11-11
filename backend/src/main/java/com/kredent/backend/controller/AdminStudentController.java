package com.kredent.backend.controller;

import com.kredent.backend.dto.AdminUpdateStudentRequest;
import com.kredent.backend.dto.PageResponse;
import com.kredent.backend.dto.RegisterRequest;
import com.kredent.backend.dto.StudentResponse;
import com.kredent.backend.service.StudentService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/admin/students")
public class AdminStudentController {

    private final StudentService studentService;

    public AdminStudentController(StudentService studentService) {
        this.studentService = studentService;
    }

    @GetMapping
    public ResponseEntity<PageResponse<StudentResponse>> listStudents(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String department,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("fullName").ascending());
        // department is the Students page's primary filter — when set, this stays a fully
        // server-side, paginated department+search query (StudentService.listStudentsByDepartment)
        // rather than fetching a department's whole roster and filtering it in the browser.
        if (department != null && !department.isBlank()) {
            return ResponseEntity.ok(studentService.listStudentsByDepartment(department, search, pageable));
        }
        return ResponseEntity.ok(studentService.listStudents(search, pageable));
    }

    @GetMapping("/{id}")
    public ResponseEntity<StudentResponse> getById(@PathVariable Long id) {
        return ResponseEntity.ok(studentService.getById(id));
    }

    @GetMapping("/usn/{usn}")
    public ResponseEntity<StudentResponse> getByUsn(@PathVariable String usn) {
        return ResponseEntity.ok(studentService.getByUsn(usn));
    }

    @PostMapping
    public ResponseEntity<StudentResponse> createStudent(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.status(HttpStatus.CREATED).body(studentService.adminCreateStudent(request));
    }

    @PutMapping("/{id}")
    public ResponseEntity<StudentResponse> updateStudent(
            @PathVariable Long id,
            @Valid @RequestBody AdminUpdateStudentRequest request) {
        return ResponseEntity.ok(studentService.adminUpdateStudent(id, request));
    }
}
