const prisma = require('../config/prismaClient');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

const CACHE_KEY_PUBLIC = 'suggested_prompts:public';
const CACHE_KEY_RAG = 'suggested_prompts:rag';
const CACHE_TTL_PUBLIC = 300;
const CACHE_TTL_RAG = 3600;

const getPublicPrompts = async (req, res) => {
  try {
    const cached = await redisService.get(CACHE_KEY_PUBLIC).catch(() => null);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), fromCache: true });

    const manual = await prisma.suggestedPrompt.findMany({
      where: { isActive: true, source: 'manual' },
      orderBy: { order: 'asc' },
      take: 3,
    });

    let ragPrompts = [];
    const ragCached = await redisService.get(CACHE_KEY_RAG).catch(() => null);
    if (ragCached) ragPrompts = JSON.parse(ragCached).slice(0, 3);

    const data = [...manual, ...ragPrompts].slice(0, 6);
    await redisService.set(CACHE_KEY_PUBLIC, JSON.stringify(data), CACHE_TTL_PUBLIC).catch(() => {});
    res.json({ success: true, data });
  } catch (error) {
    logger.error('getPublicPrompts error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil suggested prompts' });
  }
};

const getRagPrompts = async (req, res) => {
  try {
    const cached = await redisService.get(CACHE_KEY_RAG).catch(() => null);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), fromCache: true });

    let ragPrompts = [];
    try {
      const ragService = require('../services/ragService');
      const sampleDocs = await ragService.getSampleDocuments(6);
      ragPrompts = sampleDocs.map((doc, i) => ({
        id: `rag_${i}`,
        text: doc.suggestedQuestion || doc.text?.substring(0, 80) + '?',
        source: 'rag',
        isActive: true,
        order: i,
      })).filter(p => p.text && p.text.length > 10);
    } catch (ragError) {
      logger.warn('RAG prompt generation failed:', ragError.message);
    }

    await redisService.set(CACHE_KEY_RAG, JSON.stringify(ragPrompts), CACHE_TTL_RAG).catch(() => {});
    res.json({ success: true, data: ragPrompts });
  } catch (error) {
    logger.error('getRagPrompts error:', error.message);
    res.json({ success: true, data: [] });
  }
};

const getAllPrompts = async (req, res) => {
  try {
    const prompts = await prisma.suggestedPrompt.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: prompts });
  } catch (error) {
    logger.error('getAllPrompts error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
};

const createPrompt = async (req, res) => {
  const { text, category, order } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Field text wajib diisi' });
  }
  try {
    const prompt = await prisma.suggestedPrompt.create({
      data: { text: text.trim(), category: category?.trim() || null, order: order ?? 0 },
    });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.status(201).json({ success: true, data: prompt });
  } catch (error) {
    logger.error('createPrompt error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal membuat prompt' });
  }
};

const updatePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  const { text, category, order } = req.body;
  if (!text && category === undefined && order === undefined) {
    return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
  }
  try {
    const data = {};
    if (text) data.text = text.trim();
    if (category !== undefined) data.category = category?.trim() || null;
    if (order !== undefined) data.order = order;
    const prompt = await prisma.suggestedPrompt.update({ where: { id }, data });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, data: prompt });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    res.status(500).json({ success: false, message: 'Gagal update prompt' });
  }
};

const togglePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.suggestedPrompt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    const prompt = await prisma.suggestedPrompt.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, data: prompt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal toggle prompt' });
  }
};

const deletePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.suggestedPrompt.delete({ where: { id } });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, message: 'Prompt dihapus' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    res.status(500).json({ success: false, message: 'Gagal hapus prompt' });
  }
};

module.exports = { getPublicPrompts, getRagPrompts, getAllPrompts, createPrompt, updatePrompt, togglePrompt, deletePrompt };
