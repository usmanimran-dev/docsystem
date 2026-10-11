package com.edms.examination.service;

import com.edms.examination.exception.AnalysisNotFoundException;
import com.edms.examination.model.DocumentRecord;
import com.edms.examination.repository.DocumentRecordRepository;
import com.mongodb.client.gridfs.model.GridFSFile;
import org.bson.types.ObjectId;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.gridfs.GridFsOperations;
import org.springframework.data.mongodb.gridfs.GridFsTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;

/**
 * Stores the analysed document itself alongside its analysis.
 *
 * The Document Reader previously kept the uploaded file only in browser
 * memory - the analysis persisted, the document did not, so reloading the
 * page left a saved record with nothing to show for it. Files go into
 * GridFS rather than a document field because MongoDB caps a single
 * document at 16MB, and a scanned multi-page PDF can exceed that.
 *
 * GridFS lives in the same database as everything else here, so a backup
 * or a deployment copy still covers both the analyses and their files.
 */
@Service
public class DocumentFileService {

    private final GridFsTemplate gridFsTemplate;
    private final GridFsOperations gridFsOperations;
    private final DocumentRecordRepository repository;

    public DocumentFileService(GridFsTemplate gridFsTemplate,
                                GridFsOperations gridFsOperations,
                                DocumentRecordRepository repository) {
        this.gridFsTemplate = gridFsTemplate;
        this.gridFsOperations = gridFsOperations;
        this.repository = repository;
    }

    /**
     * Attaches a file to an existing analysis. Replacing an existing file
     * deletes the old one rather than orphaning it in GridFS.
     */
    public String store(String analysisId, MultipartFile file) throws IOException {
        DocumentRecord record = repository.findById(analysisId)
            .orElseThrow(() -> new AnalysisNotFoundException(analysisId));

        if (record.getFileId() != null) {
            deleteFile(record.getFileId());
        }

        ObjectId fileId = gridFsTemplate.store(
            file.getInputStream(),
            file.getOriginalFilename(),
            file.getContentType()
        );

        record.setFileId(fileId.toHexString());
        repository.save(record);

        return fileId.toHexString();
    }

    /** @return null when the analysis exists but has no file attached. */
    public StoredFile load(String analysisId) throws IOException {
        DocumentRecord record = repository.findById(analysisId)
            .orElseThrow(() -> new AnalysisNotFoundException(analysisId));

        if (record.getFileId() == null) {
            return null;
        }

        GridFSFile file = gridFsTemplate.findOne(
            new Query(Criteria.where("_id").is(new ObjectId(record.getFileId())))
        );

        if (file == null) {
            // Record points at a file that is no longer in GridFS. Treat it
            // as "no file" rather than a 500 - the analysis is still valid.
            return null;
        }

        String contentType = file.getMetadata() != null
            ? file.getMetadata().getString("_contentType")
            : null;

        return new StoredFile(
            gridFsOperations.getResource(file).getInputStream(),
            file.getFilename(),
            contentType,
            file.getLength()
        );
    }

    /** Called when an analysis is deleted, so its file does not outlive it. */
    public void deleteForAnalysis(DocumentRecord record) {
        if (record.getFileId() != null) {
            deleteFile(record.getFileId());
        }
    }

    private void deleteFile(String fileId) {
        gridFsTemplate.delete(new Query(Criteria.where("_id").is(new ObjectId(fileId))));
    }

    public record StoredFile(InputStream content, String filename, String contentType, long size) {}
}
