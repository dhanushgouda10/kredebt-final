package com.kredent.backend.service;

import com.kredent.backend.dto.CollegeOption;
import com.kredent.backend.entity.Institution;
import com.kredent.backend.registry.RegistryInstitution;
import com.kredent.backend.registry.RegistryService;
import com.kredent.backend.registry.RegistryStatus;
import com.kredent.backend.repository.InstitutionRepository;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class InstitutionDirectoryServiceTest {

    private static RegistryInstitution reg(String id, String name, String state, String district) {
        return new RegistryInstitution(1L, id, name, state, district, "HOI", "secret@x.example", "1", "h",
                RegistryStatus.APPROVED, true, Instant.now());
    }

    @Test
    void listsApprovedCollegesSortedWithJoinedFlagAndNoContactDetails() {
        RegistryService registry = mock(RegistryService.class);
        InstitutionRepository repo = mock(InstitutionRepository.class);
        when(registry.listApproved()).thenReturn(List.of(
                reg("B-2", "Riverbend College", "Maharashtra", "Pune"),
                reg("A-1", "Greenfield Institute", "Karnataka", "Bengaluru")));
        Institution joined = new Institution();
        joined.setRegistryInstitutionId("A-1");
        joined.setVerified(true);
        joined.setVerifiedAt(LocalDateTime.now());
        joined.setWalletAddress("0x1111111111111111111111111111111111111111");
        joined.setWalletLinkedAt(LocalDateTime.now());
        when(repo.findAll()).thenReturn(List.of(joined));

        InstitutionDirectoryService service = new InstitutionDirectoryService(registry, repo);
        List<CollegeOption> all = service.listColleges(null);

        assertEquals("Greenfield Institute", all.get(0).name());
        assertTrue(all.get(0).joinedKredent());
        assertFalse(all.get(1).joinedKredent());
        assertEquals(1, service.listColleges("pune").size());
        assertEquals(0, service.listColleges("nowhere").size());
    }
}
