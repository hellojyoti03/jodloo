const express = require('express');
const router = express.Router();
const Category = require('../models/category');
const auth = require('../middleware/auth');
// const adminCheck = require('../middleware/adminCheck');  // Middleware to check if the user is an admin
const authAdmin = require('../middleware/authAdmin');

// Create a new category (Admin only)
router.post('/create', authAdmin, async (req, res) => {
    const { name, logo } = req.body;

    if (!name || !logo) {
        return res.status(400).json({ msg: 'Name and logo are required' });
    }

    try {
        const category = new Category({ name, logo });
        await category.save();
        res.status(201).json({ msg: 'Category created successfully', category });
    } catch (err) {
        console.error('Error creating category:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Update a category (Admin only)
router.put('/update/:id', authAdmin, async (req, res) => {
    const { name, logo } = req.body;

    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ msg: 'Category not found' });
        }

        category.name = name || category.name;
        category.logo = logo || category.logo;

        await category.save();
        res.status(200).json({ msg: 'Category updated successfully', category });
    } catch (err) {
        console.error('Error updating category:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Delete a category (Admin only)
router.delete('/delete/:id', authAdmin, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ msg: 'Category not found' });
        }

        await category.remove();
        res.status(200).json({ msg: 'Category deleted successfully' });
    } catch (err) {
        console.error('Error deleting category:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Get all categories (Public)
router.get('/', async (req, res) => {
    try {
        const categories = await Category.find();
        res.status(200).json({ categories });
    } catch (err) {
        console.error('Error fetching categories:', err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
