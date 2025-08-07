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
            origin: ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:3002', 'http://localhost:4040'],
            credentials: true
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

                // Check if username exists in Wyrt's chars table
                const checkUserQuery = "SELECT charid FROM chars WHERE name = ?";
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

                // Create character using Wyrt's schema
                const createCharQuery = `INSERT INTO chars 
                    (name, password, email, zone, home, class, gmlv) 
                    VALUES (?, ?, ?, 'grim_wood', 'grim_wood', 1, 0)`;
                
                const result: any = await new Promise((resolve, reject) => {
                    this.context.connection.query(createCharQuery, [username, hashedPassword, email || null], (error, results) => {
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

                // Get character from Wyrt's chars table
                const getCharQuery = "SELECT charid, name, password, gmlv FROM chars WHERE name = ?";
                const character: any = await new Promise((resolve, reject) => {
                    this.context.connection.query(getCharQuery, [username], (error, results: any) => {
                        if (error) reject(error);
                        else resolve(results[0]);
                    });
                });

                if (!character) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                // Verify password
                const passwordValid = await this.context.authManager.comparePassword(password, character.password);
                
                if (!passwordValid) {
                    return res.status(401).json({ 
                        success: false, 
                        message: 'Invalid username or password' 
                    });
                }

                // Update last login
                const updateLoginQuery = "UPDATE chars SET last_login = NOW() WHERE charid = ?";
                this.context.connection.query(updateLoginQuery, [character.charid]);

                // Generate token
                const payload: AuthPayload = {
                    userId: character.charid,
                    username: character.name,
                    gmlv: character.gmlv || 0
                };

                const token = this.context.authManager.generateToken(payload);

                this.context.logger.info(colors.green(`User logged in via HTTP: ${username} (ID: ${character.charid})`));

                res.json({
                    success: true,
                    token: token,
                    id: character.charid,
                    username: character.name,
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