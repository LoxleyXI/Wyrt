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
import { ModuleData } from "./ModuleData";

export class ModuleLoader {
    private static moduleData: ModuleData;

    public static init(obj: ModuleData) {
        this.moduleData = obj;
    }

    public static loadDir(obj: ModuleData, dataType: string, dirPath: string) {
        if (!fs.existsSync(dirPath)) {
            console.log(`✗ ${dataType}: directory not found`);
            return;
        }

        const result = fs.readdirSync(dirPath, { recursive: true });
        const str: string[] = [];
        const errors: string[] = [];

        for (const filename of result) {
            const filePath = path.join(dirPath, filename.toString());
            const fileExt = path.extname(filename.toString());

            if (fs.statSync(filePath).isDirectory()) {
                continue;
            }

            const moduleLoader = obj.getLoader(dataType);

            if (moduleLoader) {
                const supportedExts = obj.getSupportedExtensions(dataType);
                if (supportedExts.includes(fileExt)) {
                    try {
                        if (moduleLoader.load(obj, filePath)) {
                            str.push(filename.toString().replace(fileExt, ''));
                        }
                    }
                    catch (error) {
                        errors.push(`${filename}: ${error.message}`);
                    }
                }
            }
        }

        // Show errors if any
        if (errors.length > 0) {
            console.log(`✗ ${dataType}: ${errors.join(', ')}`);
        }

        // Show loaded files in one line
        if (str.length > 0) {
            console.log(`✓ ${dataType}: ${str.join(', ')}`);
        } else if (errors.length === 0) {
            console.log(`✓ ${dataType}: no files`);
        }
    }
}
