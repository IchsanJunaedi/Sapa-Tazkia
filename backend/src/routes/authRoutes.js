import express from 'express';
import * as authService from '../services/authService.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// --- CONTROLLER SEDERHANA UNTUK REGISTER ---
// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const data = await authService.registerUser(req.body);
    res.status(201).json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- CONTROLLER SEDERHANA UNTUK LOGIN ---
// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const data = await authService.loginUser(email, password);
    res.status(200).json(data);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// --- CONTROLLER SEDERHANA UNTUK GET USER PROFILE ---
// GET /api/auth/me
// Rute ini diproteksi. Anda harus menyertakan token
router.get('/me', protect, (req, res) => {
  // Data 'req.user' didapat dari middleware 'protect'
  res.status(200).json({ user: req.user });
});

export default router;