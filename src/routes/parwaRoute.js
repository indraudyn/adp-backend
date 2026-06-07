const express = require("express");
const router = express.Router();
const {
  getAllParwa,
  searchParwa,
  getParwaById,
  createParwa,
  updateParwa,
  deleteParwa,
  getParwaCategories,
  getSectionsByBook,
  getContentBySection,
  getVersions,
  getUserUploads,
} = require("../controllers/parwaController");
const { verifyToken } = require("../middleware/verifyToken");

// Public routes
router.get("/", getAllParwa); // GET /api/parwa?page=1&limit=10
router.get("/categories", getParwaCategories);
router.get("/search", searchParwa); // GET /api/parwa/search?q=...
router.get("/content/:bookName/:sectionName", getContentBySection);
router.get("/read/:bookName/:sectionName", getContentBySection);
router.get("/sections/:bookName", getSectionsByBook);
router.get("/versions", getVersions)

// Authenticated user routes
router.get("/user/uploads", verifyToken, getUserUploads);
router.get("/:id", getParwaById); // GET /api/parwa/:id

// Admin routes
router.post("/", verifyToken, createParwa); // POST /api/parwa
router.put("/:id", verifyToken, updateParwa); // PUT /api/parwa/:id
router.delete("/:id", verifyToken, deleteParwa); // DELETE /api/parwa/:id

module.exports = router;
