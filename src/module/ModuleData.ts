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
import { Data } from "../types/Data";

export interface DataLoader {
    load(obj: Data, path: string): Promise<boolean> | boolean;
    validate?(data: any): boolean;
}

export class ModuleData extends Data {
    private moduleLoaders: Map<string, DataLoader> = new Map();
    private moduleDataTypes: Map<string, string[]> = new Map();

    registerLoader(dataType: string, loader: DataLoader, fileExtensions: string[] = ['.yaml', '.yml']): void {
        this.moduleLoaders.set(dataType, loader);
        this.moduleDataTypes.set(dataType, fileExtensions);
    }

    getLoader(dataType: string): DataLoader | undefined {
        return this.moduleLoaders.get(dataType);
    }

    getSupportedExtensions(dataType: string): string[] {
        return this.moduleDataTypes.get(dataType) || ['.yaml', '.yml'];
    }

    getAllLoaders(): Map<string, DataLoader> {
        return new Map(this.moduleLoaders);
    }
}
