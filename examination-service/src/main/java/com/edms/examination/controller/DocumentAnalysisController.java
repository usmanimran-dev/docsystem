package com.edms.examination.controller;

import com.edms.examination.dto.AnalysisResponse;
import com.edms.examination.dto.AnalysisSummary;
import com.edms.examination.dto.SaveAnalysisRequest;
import com.edms.examination.service.DocumentAnalysisService;
import com.edms.examination.service.DocumentFileService;
import jakarta.validation.Valid;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.core.io.InputStreamResource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

/**
 * Persistence for Document Reader analyses.
 *
 * Gated on modules.extraction.enabled: a client who only wants the DMS can
 * switch this whole module off in their .properties file and these endpoints
 * simply will not exist - no rebuild, no separate branch.
 */
@RestController
@RequestMapping("/documents")
@ConditionalOnProperty(prefix = "modules.extraction", name = "enabled", havingValue = "true", matchIfMissing = true)
public class DocumentAnalysisController {

    private final DocumentAnalysisService service;
    private final DocumentFileService fileService;

    public DocumentAnalysisController(DocumentAnalysisService service,
                                       DocumentFileService fileService) {
        this.service = service;
        this.fileService = fileService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AnalysisResponse save(@Valid @RequestBody SaveAnalysisRequest request) {
        return service.save(request);
    }

    @GetMapping("/{id}")
    public AnalysisResponse getById(@PathVariable String id) {
        return service.getById(id);
    }

    @GetMapping
    public Page<AnalysisSummary> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return service.list(PageRequest.of(page, Math.min(size, 100)));
    }

    @GetMapping("/by-hash/{fileHash}")
    public List<AnalysisSummary> findByHash(@PathVariable String fileHash) {
        return service.findByHash(fileHash);
    }

    /** The re-scanned-document case - same content, different bytes. See DocumentRecord.contentKey. */
    @GetMapping("/by-content-key/{contentKey}")
    public List<AnalysisSummary> findByContentKey(@PathVariable String contentKey) {
        return service.findByContentKey(contentKey);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable String id) {
        service.delete(id);
    }

    /**
     * Attaches the analysed document itself to an analysis, so reloading
     * the reader can show the document again and not just its findings.
     * Kept separate from the save call because the analysis is worth
     * keeping even when storing the file fails.
     */
    @PostMapping("/{id}/file")
    public ResponseEntity<Map<String, String>> uploadFile(
            @PathVariable String id,
            @RequestParam("file") MultipartFile file) throws IOException {

        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body(Map.of("error", "No file uploaded"));
        }
        return ResponseEntity.ok(Map.of("fileId", fileService.store(id, file)));
    }

    /** 404 when the analysis exists but was saved without its file. */
    @GetMapping("/{id}/file")
    public ResponseEntity<InputStreamResource> downloadFile(@PathVariable String id) throws IOException {
        DocumentFileService.StoredFile file = fileService.load(id);

        if (file == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType(
                file.contentType() != null ? file.contentType() : MediaType.APPLICATION_OCTET_STREAM_VALUE))
            .contentLength(file.size())
            .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"" + file.filename() + "\"")
            .body(new InputStreamResource(file.content()));
    }
}
