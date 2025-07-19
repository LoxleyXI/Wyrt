//----------------------------------
// Wyrt - An MMO Engine
//----------------------------------
// Copyright (c) 2025 LoxleyXI
//
// https://github.com/LoxleyXI/Wyrt
//----------------------------------
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see http://www.gnu.org/licenses/
//----------------------------------
import fs from "fs";
import path from "path";
import { EventEmitter } from "events";
import { Logger } from "../server/ConsoleLogger";

export interface WatchedFile {
    filePath: string;
    dataType: string;
    moduleName: string;
    lastModified: number;
}

export class FileWatcher extends EventEmitter {
    private watchers: Map<string, fs.FSWatcher> = new Map();
    private watchedFiles: Map<string, WatchedFile> = new Map();
    private logger: Logger;
    private debounceTimeout: Map<string, NodeJS.Timeout> = new Map();
    private debounceDelay: number = 500; // 500ms

    constructor(logger: Logger) {
        super();
        this.logger = logger;
    }

    watchDirectory(dirPath: string, dataType: string, moduleName: string): void {
        if (!fs.existsSync(dirPath)) {
            this.logger.warn(`Cannot watch directory ${dirPath} - does not exist`);

            return;
        }

        this.findAndWatchFiles(dirPath, dataType, moduleName);

        const watcher = fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
            if (!filename) return;

            const filePath = path.join(dirPath, filename);
            const fileExt = path.extname(filename);

            if (fileExt === '.yaml' || fileExt === '.yml') {
                if (eventType === 'change' || eventType === 'rename') {
                    this.handleFileChange(filePath, dataType, moduleName);
                }
            }
        });

        watcher.on("error", (error) => {
            this.logger.error(`File watcher error for ${dirPath}:`, error);
        });

        this.watchers.set(dirPath, watcher);
        this.logger.debug(`Watching directory: ${dirPath} (${dataType})`);
    }

    private findAndWatchFiles(dirPath: string, dataType: string, moduleName: string): void {
        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(dirPath, entry.name);

                if (entry.isDirectory()) {
                    this.findAndWatchFiles(fullPath, dataType, moduleName);
                }

                else if (entry.isFile() && (entry.name.endsWith(".yaml") || entry.name.endsWith(".yml"))) {
                    const stats = fs.statSync(fullPath);

                    this.watchedFiles.set(fullPath, {
                        filePath: fullPath,
                        dataType: dataType,
                        moduleName: moduleName,
                        lastModified: stats.mtime.getTime()
                    });
                }
            }
        }

        catch (error) {
            this.logger.error(`Error scanning directory ${dirPath}:`, error);
        }
    }

    private handleFileChange(filePath: string, dataType: string, moduleName: string): void {
        const existingTimeout = this.debounceTimeout.get(filePath);

        if (existingTimeout) {
            clearTimeout(existingTimeout);
        }

        const timeout = setTimeout(() => {
            this.processFileChange(filePath, dataType, moduleName);
            this.debounceTimeout.delete(filePath);
        }, this.debounceDelay);

        this.debounceTimeout.set(filePath, timeout);
    }

    private processFileChange(filePath: string, dataType: string, moduleName: string): void {
        try {
            if (!fs.existsSync(filePath)) {
                this.logger.info(`File deleted: ${filePath}`);
                this.watchedFiles.delete(filePath);
                this.emit('fileDeleted', filePath, dataType, moduleName);

                return;
            }

            const stats = fs.statSync(filePath);
            const watchedFile = this.watchedFiles.get(filePath);

            if (!watchedFile) {
                this.logger.info(`New file detected: ${filePath}`);

                this.watchedFiles.set(filePath, {
                    filePath: filePath,
                    dataType: dataType,
                    moduleName: moduleName,
                    lastModified: stats.mtime.getTime()
                });

                this.emit("fileAdded", filePath, dataType, moduleName);
            }

            else if (stats.mtime.getTime() > watchedFile.lastModified) {
                this.logger.info(`File modified: ${filePath}`);

                watchedFile.lastModified = stats.mtime.getTime();

                this.emit("fileChanged", filePath, dataType, moduleName);
            }
        }

        catch (error) {
            this.logger.error(`Error processing file change for ${filePath}:`, error);
        }
    }

    unwatchDirectory(dirPath: string): void {
        const watcher = this.watchers.get(dirPath);
        if (watcher) {
            watcher.close();
            this.watchers.delete(dirPath);
            this.logger.debug(`Stopped watching directory: ${dirPath}`);
        }

        for (const [filePath, watchedFile] of this.watchedFiles.entries()) {
            if (filePath.startsWith(dirPath)) {
                this.watchedFiles.delete(filePath);
            }
        }
    }

    stopAll(): void {
        for (const [dirPath, watcher] of this.watchers.entries()) {
            watcher.close();
        }

        this.watchers.clear();
        this.watchedFiles.clear();
        this.logger.info("Stopped all file watchers");
    }

    getWatchedFiles(): WatchedFile[] {
        return Array.from(this.watchedFiles.values());
    }
}
