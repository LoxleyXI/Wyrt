// File: modules/core/loaders/items.ts (FIXED)
import { DataLoader } from "../../../src/module/ModuleData";
import { Data } from "../../../src/types/Data";
import fs from "fs";
import yaml from "js-yaml";

const loader: DataLoader = {
    load: (obj: Data, path: string): boolean => {
        try {
            const result = yaml.load(fs.readFileSync(path, "utf8")) as any;

            if (!obj.items) {
                obj.items = {};
            }

            for (const name in result) {
                obj.items[name] = result[name];
            }

            console.log(`Loaded ${Object.keys(result).length} items from ${path}`);
            return true;
        } catch (err) {
            console.log("Items failed to parse:", err);
            return false;
        }
    },
    validate: (data: any): boolean => {
        return data && typeof data === 'object';
    }
};

export default loader;
