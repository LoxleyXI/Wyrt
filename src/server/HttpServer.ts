import express, { Express, Request, Response } from 'express';
import cors from 'cors';
import { ModuleContext } from '../module/ModuleContext';
import { AuthPayload } from './AuthManager';
import colors from 'colors/safe';

export class HttpServer {
    private app: Express;
    private context: ModuleContext;
    private port: number;

    constructor(context: ModuleContext, port: number = 3001) {
        this.context = context;
        this.port = port;
        this.app = express();
        this.setupMiddleware();
        this.setupRoutes();
    }

    private setupMiddleware(): void {
        // Enable CORS for the frontend
        this.app.use(cors({
            origin: function(origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
                // Allow requests with no origin (like mobile apps or Postman)
                if (!origin) return callback(null, true);
                
                // Allow any localhost origin
                if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
                    return callback(null, true);
                }
                
                // Block everything else
                callback(new Error('Not allowed by CORS'));
            },
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization'],
            preflightContinue: false,
            optionsSuccessStatus: 200
        }));

        // Parse JSON bodies
        this.app.use(express.json());

        // Request logging
        this.app.use((req, res, next) => {
            this.context.logger.debug(`HTTP ${req.method} ${req.path}`);
            next();
        });
    }

    private setupRoutes(): void {
        // Health check
        this.app.get('/health', (req: Request, res: Response) => {
            res.json({ 
                status: 'ok', 
                server: 'Wyrt/Ironwood',
                timestamp: Date.now() 
            });
        });

        // Authentication routes
        this.app.post('/api/auth/register', async (req: Request, res: Response) => {
            try {
                const { username, password, email } = req.body;

                // Validate input
                if (!username || !password) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username and password are required' 
                    });
                }

                if (username.length < 3 || username.length > 20) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username must be between 3 and 20 characters' 
                    });
                }

                if (password.length < 6) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Password must be at least 6 characters' 
                    });
                }

                // Check if username exists in accounts table
                const checkUserQuery = "SELECT id FROM accounts WHERE username = ?";
                const existingUser: any = await new Promise((resolve, reject) => {
                    this.context.connection.query(checkUserQuery, [username], (error, results: any) => {
                        if (error) reject(error);
                        else resolve(results[0]);
                    });
                });

                if (existingUser) {
                    return res.status(409).json({ 
                        success: false, 
                        message: 'Username already taken' 
                    });
                }

                // Hash password
                const hashedPassword = await this.context.authManager.hashPassword(password);

                // Create account using new schema
                const createAccountQuery = `INSERT INTO accounts 
                    (username, email, password_hash) 
                    VALUES (?, ?, ?)`;
                
                const result: any = await new Promise((resolve, reject) => {
                    this.context.connection.query(createAccountQuery, [username, email || `${username}@example.com`, hashedPassword], (error, results) => {
                        if (error) reject(error);
                        else resolve(results);
                    });
                });

                const userId = result.insertId;

                // Generate token
                const payload: AuthPayload = {
                    userId: userId,
                    username: username,
                    gmlv: 0
                };

                const token = this.context.authManager.generateToken(payload);

                this.context.logger.info(colors.green(`New account registered via HTTP: ${username} (ID: ${userId})`));

                res.json({
                    success: true,
                    token: token,
                    id: userId,
                    username: username,
                    message: 'Account created successfully'
                });

            } catch (error) {
                this.context.logger.error('Registration error:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Registration failed. Please try again.' 
                });
            }
        });

        this.app.post('/api/auth/login', async (req: Request, res: Response) => {
            try {
                const { username, password } = req.body;

                // Validate input
                if (!username || !password) {
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Username and password are required' 
                    });
                }

                // Get account from accounts table
                const getAccountQuery = "SELECT id, username, password_hash, status FROM accounts WHERE username = ?";
                const account: any = await new Promise((resolve, reject) => {
                    this.context.connection.query(getAccountQuery, [username], (error, results: any) => {
                        if (error) reject(error);
                        else resolve(results[0]);
                    });
                });

                if (!account) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                // Verify password
                const passwordValid = await this.context.authManager.comparePassword(password, account.password_hash);
                
                if (!passwordValid) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                // Update last login
                const updateLoginQuery = "UPDATE accounts SET last_login = NOW() WHERE id = ?";
                this.context.connection.query(updateLoginQuery, [account.id]);

                // Generate token
                const payload: AuthPayload = {
                    userId: account.id,
                    username: account.username,
                    gmlv: 0
                };

                const token = this.context.authManager.generateToken(payload);

                this.context.logger.info(colors.green(`User logged in via HTTP: ${username} (ID: ${account.id})`));

                res.json({
                    success: true,
                    token: token,
                    id: account.id,
                    username: account.username,
                    message: 'Login successful'
                });

            } catch (error) {
                this.context.logger.error('Login error:', error);
                res.status(500).json({ 
                    success: false, 
                    message: 'Login failed. Please try again.' 
                });
            }
        });

        // Verify token endpoint
        this.app.get('/api/auth/verify', (req: Request, res: Response) => {
            const authHeader = req.headers.authorization;
            
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'No token provided' 
                });
            }

            const token = authHeader.substring(7);
            const payload = this.context.authManager.verifyToken(token);

            if (!payload) {
                return res.status(401).json({ 
                    success: false, 
                    message: 'Invalid or expired token' 
                });
            }

            res.json({
                success: true,
                userId: payload.userId,
                username: payload.username,
                gmlv: payload.gmlv
            });
        });

        // Generic module data API
        this.app.get('/api/data/:module/:category/:name?', async (req: Request, res: Response) => {
            try {
                const { module: moduleName, category, name } = req.params;

                // Check if module exists
                const module = this.context.getModule(moduleName);
                if (!module) {
                    return res.status(404).json({
                        success: false,
                        message: `Module '${moduleName}' not found`
                    });
                }

                // Build data path
                const dataPath = name
                    ? `${moduleName}.${category}.${name}`
                    : `${moduleName}.${category}`;

                // Get data from module's data store
                const data = this.context.data[moduleName]?.[category];

                if (!data) {
                    return res.status(404).json({
                        success: false,
                        message: `Data category '${category}' not found in module '${moduleName}'`
                    });
                }

                // If specific item requested
                if (name) {
                    const item = data[name];
                    if (!item) {
                        return res.status(404).json({
                            success: false,
                            message: `Item '${name}' not found in ${moduleName}.${category}`
                        });
                    }

                    return res.json({
                        success: true,
                        data: item
                    });
                }

                // Return entire category
                res.json({
                    success: true,
                    data: data
                });

            } catch (error) {
                this.context.logger.error(`Error loading module data: ${error}`);
                res.status(500).json({
                    success: false,
                    message: 'Internal server error'
                });
            }
        });

        // 404 handler
        this.app.use((req: Request, res: Response) => {
            res.status(404).json({ 
                success: false, 
                message: 'Endpoint not found' 
            });
        });
    }

    public start(): void {
        this.app.listen(this.port, () => {
            this.context.logger.info(colors.cyan(`HTTP Server listening on port ${this.port}`));
        });
    }
}