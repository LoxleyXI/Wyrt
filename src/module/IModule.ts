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
import { ModuleContext } from "./ModuleContext";

// Base module interface
export interface IModule {
    name: string;
    version: string;
    description?: string;
    dependencies?: string[];

    // Lifecycle methods
    initialize?(context: ModuleContext): Promise<void> | void;
    activate?(context: ModuleContext): Promise<void> | void;
    deactivate?(context: ModuleContext): Promise<void> | void;
}
