/**
 * Wyrt Admin Panel
 *
 * Web-based administration interface for managing Wyrt servers.
 * Provides real-time monitoring, module management, and server controls.
 */

import { IModule, ModuleContext } from '../../src/module/IModule';

export default class WyrtAdminModule implements IModule {
    name = 'wyrt_admin';
    version = '1.0.0';
    description = 'Wyrt administration panel';
    dependencies = ['wyrt_core'];

    private context?: ModuleContext;

    async initialize(context: ModuleContext): Promise<void> {
        this.context = context;
        console.log(`[${this.name}] Admin panel initialized`);
    }

    async activate(): Promise<void> {
        if (!this.context) {
            throw new Error('Context not initialized');
        }

        console.log(`[${this.name}] Admin panel activated`);
        console.log(`[${this.name}] Web interface available when server starts`);
    }

    async deactivate(): Promise<void> {
        console.log(`${this.name} admin panel deactivated`);
    }
}
