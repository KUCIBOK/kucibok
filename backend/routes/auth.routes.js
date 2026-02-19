const express = require("express");
const router = express.Router();
const { admin, auth } = require("../middleware/auth");
const {
  register,
  login,
  getUserById,
  updateUser,
  getAllUsers,
  loginWithMetamask,
  getUserByEmail,
  deleteUser,
  deleteAllUsers,
  createUser,
  setUserStatus,
  changePassword,
  signUpWithMetamask,
  forgotPassword,
  resetPassword,
  verifyEmail,
  resendVerificationEmail,
  exportDataOnExcelFormat,
} = require("../controllers/auth.controllers");
const multer = require("../middleware/multer");

router.post("/register", multer, register);

router.post("/login", login);

router.post("/login-metamask", loginWithMetamask);

router.post("/signup-metamask", signUpWithMetamask);

router.patch("/change-password", auth, changePassword);

router.post("/forgot-password", forgotPassword);

router.post("/reset-password", resetPassword);

router.get("/:id", auth, getUserById);

router.get("/verify-email/:token", verifyEmail);

router.get("/resend-verification-email/:email", resendVerificationEmail);

router.get("/email/:email", auth, getUserByEmail);

//admin
router.post("/", admin, createUser);

router.get("/status/:id", admin, setUserStatus);

router.get("/", admin, getAllUsers);

router.get("/export/excel", admin, exportDataOnExcelFormat);

router.put("/:id", auth, updateUser);

router.delete("/:id", admin, deleteUser);

router.delete("/", admin, deleteAllUsers);

module.exports = router;
