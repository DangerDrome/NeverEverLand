const fs = require('fs');

class VoxParserNode {
    parseVoxFile(filePath) {
        const buffer = fs.readFileSync(filePath);
        // Convert Node.js Buffer to ArrayBuffer
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        const view = new DataView(arrayBuffer);
        
        // Check VOX file signature
        const signature = this.readString(view, 0, 4);
        if (signature !== 'VOX ') {
            throw new Error('Invalid VOX file signature');
        }
        
        // Skip version (4 bytes)
        let offset = 8;
        
        // Read chunks
        const chunks = [];
        while (offset < view.byteLength) {
            const chunk = this.readChunk(view, offset);
            if (!chunk) break;
            chunks.push(chunk);
            offset += chunk.totalSize;
        }
        
        // Find SIZE chunk to get dimensions
        const sizeChunk = chunks.find(c => c.id === 'SIZE');
        if (sizeChunk) {
            const sizeView = new DataView(sizeChunk.content);
            return {
                x: sizeView.getInt32(0, true),
                y: sizeView.getInt32(4, true),
                z: sizeView.getInt32(8, true)
            };
        }
        
        // Default size if no SIZE chunk found
        return { x: 3, y: 3, z: 3 };
    }
    
    readChunk(view, offset) {
        if (offset + 12 > view.byteLength) return null;
        
        const id = this.readString(view, offset, 4);
        const contentSize = view.getInt32(offset + 4, true);
        const childrenSize = view.getInt32(offset + 8, true);
        
        const content = new ArrayBuffer(contentSize);
        const contentView = new Uint8Array(content);
        const sourceView = new Uint8Array(view.buffer, view.byteOffset + offset + 12, contentSize);
        contentView.set(sourceView);
        
        return {
            id,
            contentSize,
            childrenSize,
            content,
            totalSize: 12 + contentSize + childrenSize
        };
    }
    
    readString(view, offset, length) {
        let str = '';
        for (let i = 0; i < length; i++) {
            str += String.fromCharCode(view.getUint8(offset + i));
        }
        return str;
    }
}

module.exports = VoxParserNode;