"use client";
import { useState, useRef, useEffect } from "react";
import {
  signInWithEmailAndPassword,
  signInWithPopup,
  sendPasswordResetEmail,
  sendEmailVerification,
} from "firebase/auth";
import {
  auth,
  db,
} from "@/components/firebase.config";
import { ref, get } from "firebase/database";
import {
  FaEye,
  FaEyeSlash,
  FaEnvelope,
  FaCheckCircle,
  FaLock,
  FaArrowLeft,
} from "react-icons/fa";
import Signup from "./Signup";
import "@/app/styles/authentication/login.css";
import { useRouter } from "next/navigation";

export default function Login({
  onClose = () => {},
  currentPath = "/",
  onLoginSuccess = () => {},
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const [resetPasswordSuccess, setResetPasswordSuccess] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const modalRef = useRef(null);
  const router = useRouter();
  const [showNotification, setShowNotification] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");

  useEffect(() => {
    document.body.classList.add("modal-open");

    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      document.body.classList.remove("modal-open");
      onClose();
    }, 300);
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

      if (!userCredential.user.emailVerified) {
        await auth.signOut();
        setVerificationSent(true);
        await sendEmailVerification(userCredential.user);
      } else {
        onLoginSuccess();
        setTimeout(() => {
          onClose();
          router.push(currentPath);
        }, 1000);
      }
    } catch (error) {
      setError(
        "Unable to log in. Please check your credentials and try again."
      );
    }
  };

  const handleSocialLogin = async (provider) => {
    try {

      const result = await signInWithPopup(auth, provider);

      if (!result.user.emailVerified) {
        await auth.signOut();
        setVerificationSent(true);
        await sendEmailVerification(result.user);
      } else {
        onLoginSuccess();
        setTimeout(() => {
          onClose();
          router.push(currentPath);
        }, 1000);
      }
    } catch (error) {
      console.error("Social login error details:", {
        code: error.code,
        message: error.message,
        fullError: error,
      });

      let errorMessage = "Unable to complete social login. Please try again.";

      if (error.code === "auth/popup-closed-by-user") {
        errorMessage = "Login popup was closed. Please try again.";
      } else if (error.code === "auth/popup-blocked") {
        errorMessage =
          "Login popup was blocked. Please allow popups for this site.";
      } else if (error.code === "auth/cancelled-popup-request") {
        errorMessage = "Login process was cancelled. Please try again.";
      } else if (
        error.code === "auth/account-exists-with-different-credential"
      ) {
        errorMessage =
          "An account already exists with the same email address but different sign-in credentials.";
      }

      setError(errorMessage);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetPasswordSuccess(true);
    } catch (error) {
      setError(error.message);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleLoginSignup = () => {
    setShowSignup(!showSignup);
  };

  const handleOutsideClick = (e) => {
    if (modalRef.current && !modalRef.current.contains(e.target)) {
      handleClose();
    }
  };

  if (showSignup) {
    return (
      <Signup
        onSwitchToLogin={toggleLoginSignup}
        onClose={handleClose}
        currentPath={currentPath}
      />
    );
  }

  return (
    <div
      className={`overlay ${isClosing ? "closing" : ""}`}
      onClick={handleOutsideClick}
    >
      <div
        className={`auth-container ${isClosing ? "closing" : ""}`}
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
      >
        <button className="login-close-button" onClick={handleClose}>
          &times;
        </button>
        <h1 className="login-title">
          {showForgotPassword ? "Reset Password" : "Log In"}
        </h1>
        {!showForgotPassword ? (
          <>
            <form onSubmit={handleEmailLogin} className="form">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                required
                className="input"
              />
              <div className="password-input-auth-container">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  required
                  className="input"
                />
                <button
                  type="button"
                  onClick={togglePasswordVisibility}
                  className="password-toggle-button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <FaEyeSlash /> : <FaEye />}
                </button>
              </div>
              <button type="submit" className="button primary-button">
                <FaEnvelope className="button-icon" />
                <span>Log In with Email</span>
              </button>
            </form>
            <button
              onClick={() => setShowForgotPassword(true)}
              className="forgot-password-link"
            >
              Forgot Password?
            </button>
            <p className="signup-prompt">
              Don't have an account?{" "}
              <button onClick={toggleLoginSignup} className="switch-button">
                Sign Up
              </button>
            </p>
          </>
        ) : (
          <div className="reset-password-auth-container">
            {!resetPasswordSuccess ? (
              <>
                <div className="reset-password-icon">
                  <FaLock />
                </div>
                <form onSubmit={handleForgotPassword} className="form">
                  <div className="input-group">
                    <input
                      type="email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Email"
                      required
                      className="input"
                    />
                  </div>
                  <button type="submit" className="button primary-button">
                    <FaEnvelope className="button-icon" />
                    <span>Send Reset Link</span>
                  </button>
                </form>
              </>
            ) : (
              <div className="reset-password-success">
                <FaCheckCircle className="success-icon" />
                <h2>Reset Link Sent!</h2>
                <p>
                  We've sent password reset instructions to your email address.
                  Please check your inbox and follow the instructions to reset
                  your password.
                </p>
              </div>
            )}
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setResetPasswordSuccess(false);
                setResetEmail("");
                setError(null);
              }}
              className="back-to-login"
            >
              <FaArrowLeft />
              <span>Back to Login</span>
            </button>
          </div>
        )}
        {error && <p className="error">{error}</p>}
      </div>
      {showNotification && (
        <div className="login-notification">
          <span className="icon">✓</span>
          <span className="message">{notificationMessage}</span>
        </div>
      )}
      {verificationSent && (
        <div className="verification-message">
          <FaEnvelope className="verification-icon" />
          <h2>Verify Your Email</h2>
          <p>A verification email has been sent to your email address.</p>
          <p>
            Please check your inbox and click the verification link to complete
            the login process.
          </p>
        </div>
      )}
      {showSuccessNotification && (
        <div className={`success-notification ${isClosing ? "hiding" : ""}`}>
          <div className="success-content">
            <svg
              className="success-icon"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
              <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span className="success-message">Successfully logged in!</span>
          </div>
        </div>
      )}
    </div>
  );
}
