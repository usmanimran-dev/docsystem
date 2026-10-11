package com.edms.examination.service;

import com.edms.examination.dto.AnalysisResponse;
import com.edms.examination.dto.AnalysisSummary;
import com.edms.examination.dto.SaveAnalysisRequest;
import com.edms.examination.exception.AnalysisNotFoundException;
import com.edms.examination.mapper.AnalysisMapper;
import com.edms.examination.model.DocumentRecord;
import com.edms.examination.repository.DocumentRecordRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

@Service
public class DocumentAnalysisService {

    private final DocumentRecordRepository repository;
    private final AnalysisMapper mapper;
    private final DocumentFileService fileService;

    public DocumentAnalysisService(DocumentRecordRepository repository,
                                    AnalysisMapper mapper,
                                    DocumentFileService fileService) {
        this.repository = repository;
        this.mapper = mapper;
        this.fileService = fileService;
    }

    /**
     * The timestamp is set here rather than accepted from the client - a
     * stored record's "when was this analysed" should come from the server,
     * not from whatever clock the browser happens to have.
     */
    public AnalysisResponse save(SaveAnalysisRequest request) {
        DocumentRecord record = mapper.toEntity(request);
        record.setAnalysedAt(Instant.now());
        return mapper.toResponse(repository.save(record));
    }

    public AnalysisResponse getById(String id) {
        return repository.findById(id)
            .map(mapper::toResponse)
            .orElseThrow(() -> new AnalysisNotFoundException(id));
    }

    public Page<AnalysisSummary> list(Pageable pageable) {
        return repository.findAllByOrderByAnalysedAtDesc(pageable).map(mapper::toSummary);
    }

    /** Prior analyses of the same file - useful when an extractor improves and a document is re-run. */
    public List<AnalysisSummary> findByHash(String fileHash) {
        return repository.findByFileHashOrderByAnalysedAtDesc(fileHash)
            .stream()
            .map(mapper::toSummary)
            .toList();
    }

    /**
     * Prior analyses of the same document by CONTENT - the re-scanned /
     * re-exported case, where fileHash differs but it is the same
     * invoice/BOL/statement. A blank key matches nothing rather than
     * matching every record that also has no key.
     */
    public List<AnalysisSummary> findByContentKey(String contentKey) {
        if (contentKey == null || contentKey.isBlank()) {
            return List.of();
        }
        return repository.findByContentKeyOrderByAnalysedAtDesc(contentKey)
            .stream()
            .map(mapper::toSummary)
            .toList();
    }

    public void delete(String id) {
        DocumentRecord record = repository.findById(id)
            .orElseThrow(() -> new AnalysisNotFoundException(id));

        // Drop the stored file first: a leftover in GridFS would be
        // unreachable once the record pointing at it is gone.
        fileService.deleteForAnalysis(record);
        repository.deleteById(id);
    }
}
