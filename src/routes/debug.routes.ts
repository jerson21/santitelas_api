// src/routes/debug.routes.ts
import { Router } from 'express';
import { DebugController } from '../controllers/DebugController';

const router = Router();
const debugController = new DebugController();

// Solo habilitar rutas de debug en desarrollo
if (process.env.NODE_ENV !== 'production') {
  console.log('🐛 Rutas de debug habilitadas (modo desarrollo)');
  
  // POST /api/debug/login-test - Probar credenciales paso a paso
  router.post('/login-test', debugController.loginTest);
  
  // POST /api/debug/fix-user - Arreglar usuario admin
  router.post('/fix-user', debugController.fixUser);
  
  // GET /api/debug/all-users - Ver todos los usuarios
  router.get('/all-users', debugController.getAllUsers);
  
} else {
  console.log('🔒 Rutas de debug deshabilitadas (modo producción)');
  
  // En producción, todas las rutas devuelven 404
  router.all('*', (req, res) => {
    res.status(404).json({
      success: false,
      message: 'Debug routes not available in production'
    });
  });
}

export default router;