/**
 * Get Modules Request Handler
 *
 * Returns list of loaded modules excluding game modules (those with www frontends).
 */

import { Request } from '../../../src/types/Request';
import { User } from '../../../src/types/User';
import { Data } from '../../../src/types/Data';

const handler: Request = {
    cost: 1,
    auth: false,  // Public information

    exec: async function(u: User, data: Data, payload: any, context?: any) {
        try {
            const webManager = context?.webManager;

            // Get list of modules with frontends
            const gameModuleNames = webManager
                ? webManager.getWebApps().map((app: any) => app.name)
                : [];

            // Get module manager from context
            const moduleManager = (globalThis as any).moduleManager;

            if (!moduleManager) {
                return u.error('Module manager not available');
            }

            // Get all loaded modules
            const allModules = moduleManager.getModules();

            // Filter out game modules
            const modules = Array.from(allModules.entries())
                .filter(([name]) => !gameModuleNames.includes(name))
                .map(([name, module]: [string, any]) => ({
                    name,
                    version: module.version || '1.0.0',
                    description: module.description || 'No description'
                }));

            u.send(JSON.stringify({
                type: 'moduleList',
                modules
            }));

        } catch (error: any) {
            console.error('[getModules] Error:', error.message);
            u.error('Failed to retrieve module list');
        }
    }
};

export default handler;
