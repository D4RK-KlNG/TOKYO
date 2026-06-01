/**
 * Plugin System Manager
 * Handles plugin loading, execution, and management
 */

const logger = require('../utils/logger');
const config = require('../../config');
const path = require('path');
const fs = require('fs');

class PluginManager {
    constructor() {
        this.plugins = {};
        this.ensureDirectory();
    }

    ensureDirectory() {
        if (!fs.existsSync(config.PLUGINS_DIR)) {
            fs.mkdirSync(config.PLUGINS_DIR, { recursive: true });
        }
    }

    /**
     * Load all plugins from disk
     */
    loadAll() {
        this.plugins = {};
        const files = fs.readdirSync(config.PLUGINS_DIR).filter(f => f.endsWith('.js'));
        
        for (const file of files) {
            try {
                const pluginPath = path.join(config.PLUGINS_DIR, file);
                delete require.cache[require.resolve(pluginPath)];
                const plugin = require(pluginPath);
                const name = file.replace('.js', '');
                this.plugins[name] = plugin;
                logger.info(`Loaded plugin: ${name}`);
            } catch (error) {
                logger.error(`Failed to load ${file}:`, error.message);
            }
        }
    }

    /**
     * Install a plugin from code string
     */
    install(name, code) {
        this.ensureDirectory();
        const filePath = path.join(config.PLUGINS_DIR, `${name}.js`);
        
        if (fs.existsSync(filePath)) {
            throw new Error(`Plugin "${name}" already exists`);
        }
        
        fs.writeFileSync(filePath, code);
        this.loadAll();
        return true;
    }

    /**
     * Uninstall a plugin by name
     */
    uninstall(name) {
        const filePath = path.join(config.PLUGINS_DIR, `${name}.js`);
        
        if (!fs.existsSync(filePath)) {
            throw new Error(`Plugin "${name}" not found`);
        }
        
        fs.unlinkSync(filePath);
        delete this.plugins[name];
        return true;
    }

    /**
     * List all installed plugins
     */
    list() {
        return Object.keys(this.plugins);
    }

    /**
     * Get a plugin by name
     */
    get(name) {
        return this.plugins[name] || null;
    }
}

module.exports = PluginManager;
