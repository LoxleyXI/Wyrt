/**
 * Get Games Request Handler
 *
 * Returns list of available game modules with their ports and metadata.
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

            if (!webManager) {
                return u.error('WebManager not available');
            }

            // Get list of running web apps
            const webApps = webManager.getWebApps();

            // Transform to client-friendly format
            const games = webApps.map((app: any) => ({
                name: app.name,
                displayName: formatModuleName(app.name),
                port: app.port,
                url: `http://localhost:${app.port}`,
                description: app.packageJson?.description || 'No description available'
            }));

            u.send(JSON.stringify({
                type: 'gameList',
                games
            }));

        } catch (error: any) {
            console.error('[getGames] Error:', error.message);
            u.error('Failed to retrieve game list');
        }
    }
};

function formatModuleName(name: string): string {
    // Remove wyrt_ prefix and capitalize words
    return name
        .replace(/^wyrt_/, '')
        .split('_')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export default handler;
