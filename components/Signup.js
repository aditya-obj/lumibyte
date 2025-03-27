import { useState, useEffect, useRef } from "react";
import {
  createUserWithEmailAndPassword,
  signInWithPopup,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  auth,
} from "@/components/firebase.config";
import { useRouter } from "next/navigation";
import {
  FaEye,
  FaEyeSlash,
  FaCheckCircle,
  FaEnvelope,
  FaTimes,
} from "react-icons/fa";
import Login from "./Login";
import "@/app/styles/authentication/signup.css";
import "@/app/styles/authentication/login.css";

const GmailIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 48 48"
    className="mail-icon"
  >
    <path
      fill="#4caf50"
      d="M45,16.2l-5,2.75l-5,4.75L35,40h7c1.657,0,3-1.343,3-3V16.2z"
    ></path>
    <path
      fill="#1e88e5"
      d="M3,16.2l3.614,1.71L13,23.7V40H6c-1.657,0-3-1.343-3-3V16.2z"
    ></path>
    <polygon
      fill="#e53935"
      points="35,11.2 24,19.45 13,11.2 12,17 13,23.7 24,31.95 35,23.7 36,17"
    ></polygon>
    <path
      fill="#c62828"
      d="M3,12.298V16.2l10,7.5V11.2L9.876,8.859C9.132,8.301,8.228,8,7.298,8h0C4.924,8,3,9.924,3,12.298z"
    ></path>
    <path
      fill="#fbc02d"
      d="M45,12.298V16.2l-10,7.5V11.2l3.124-2.341C38.868,8.301,39.772,8,40.702,8h0 C43.076,8,45,9.924,45,12.298z"
    ></path>
  </svg>
);

export default function Signup({ onClose = () => {}, currentPath = "/" }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showSuccessNotification, setShowSuccessNotification] = useState(false);
  const [resendDisabled, setResendDisabled] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isEmailVerified, setIsEmailVerified] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [hasStartedTyping, setHasStartedTyping] = useState(false);
  const router = useRouter();
  const modalRef = useRef(null);

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email) return "Email is required";
    if (!emailRegex.test(email)) return "Please enter a valid email address";
    return "";
  };

  const validatePassword = (password) => {
    if (!password) return "Password is required";
    if (password.length < 6) return "Password must be at least 6 characters";
    return "";
  };

  const checkVerificationStatus = async () => {
    try {
      await auth.currentUser?.reload();
      if (auth.currentUser?.emailVerified) {
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
          onClose();
        }, 3000);
      }
    } catch (error) {
      console.error("Error checking verification status:", error);
    }
  };

  useEffect(() => {
    if (verificationSent) {
      const interval = setInterval(checkVerificationStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [verificationSent]);

  useEffect(() => {
    let intervalId;
    if (verificationSent && !isEmailVerified) {
      intervalId = setInterval(async () => {
        try {
          if (!auth.currentUser) return; // Skip if no user

          await auth.currentUser.reload();
          if (auth.currentUser.emailVerified) {
            clearInterval(intervalId);
            setIsEmailVerified(true);

            // Force a complete re-authentication
            try {
              await signOut(auth); // Sign out first
              const result = await signInWithEmailAndPassword(
                auth,
                email,
                password
              );
              await result.user.reload(); // Make sure to reload the user data

              setShowSuccessNotification(true);
              setTimeout(() => {
                setShowSuccessNotification(false);
                onClose();
              }, 3000);
            } catch (authError) {
              console.error("Error during re-authentication:", authError);
              setError(
                "Error completing signup. Please try logging in manually."
              );
            }
          }
        } catch (error) {
          console.error("Error checking email verification:", error);
        }
      }, 2000);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [
    verificationSent,
    isEmailVerified,
    onClose,
    currentPath,
    email,
    password,
  ]);

  useEffect(() => {
    let cooldownTimer;
    if (resendCooldown > 0) {
      cooldownTimer = setInterval(() => {
        setResendCooldown((prevCooldown) => prevCooldown - 1);
      }, 1000);
    } else {
      setResendDisabled(false);
    }

    return () => {
      if (cooldownTimer) {
        clearInterval(cooldownTimer);
      }
    };
  }, [resendCooldown]);

  useEffect(() => {
    // Add class to body when component mounts
    document.body.classList.add("modal-open");

    // Remove class when component unmounts
    return () => {
      document.body.classList.remove("modal-open");
    };
  }, []);

  const handleEmailSignup = async (e) => {
    e.preventDefault();

    const emailError = validateEmail(email);
    const passwordError = validatePassword(password);

    if (emailError || passwordError) {
      setError(emailError || passwordError);
      return;
    }

    try {
      setError(null); // Clear any previous errors

      // Create the user account
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

      // Send verification email
      await sendEmailVerification(userCredential.user);
      setVerificationSent(true);

      // No need to force reload here as we'll handle it in the verification check
    } catch (error) {
      console.error("Signup error:", error);
      if (error.code === "auth/email-already-in-use") {
        setError(
          "This email is already registered. Please try logging in instead."
        );
      } else {
        setError(error.message);
      }
    }
  };

  const handleSocialSignup = async (provider) => {
    try {
      setError(null); // Clear any previous errors

      const result = await signInWithPopup(auth, provider);
      if (result.user.emailVerified) {
        await result.user.reload();
        setShowSuccessNotification(true);
        setTimeout(() => {
          setShowSuccessNotification(false);
          router.push(currentPath);
          onClose();
        }, 3000);
      } else {
        await sendEmailVerification(result.user);
        setVerificationSent(true);
      }
    } catch (error) {
      console.error("Social signup error:", error);
      setError(error.message);
    }
  };

  const handleResendVerification = async () => {
    if (resendDisabled) {
      return;
    }

    try {
      // Sign in the user with email and password
      await signInWithEmailAndPassword(auth, email, password);

      // Send verification email
      await sendEmailVerification(auth.currentUser);

      // Sign out the user
      await auth.signOut();

      setResendDisabled(true);
      setResendCooldown(60); // Set cooldown to 60 seconds
      setError("Verification email resent. Please check your inbox.");
    } catch (error) {
      setError(error.message);
    }
  };

  const handleOutsideClick = (e) => {
    if (
      modalRef.current &&
      !modalRef.current.contains(e.target) &&
      !verificationSent
    ) {
      handleClose();
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const toggleLoginSignup = () => {
    setShowLogin(!showLogin);
  };

  const handleClose = () => {
    if (verificationSent) return;
    setIsClosing(true);
    setTimeout(() => {
      document.body.classList.remove("modal-open");
      onClose();
    }, 300);
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    setEmailError(validateEmail(value));
  };

  const handlePasswordChange = (e) => {
    const value = e.target.value;
    setPassword(value);

    // Only show validation after user starts typing
    if (!hasStartedTyping && value.length > 0) {
      setHasStartedTyping(true);
    }

    // Only show basic password error if user has started typing
    if (hasStartedTyping) {
      setPasswordError(validatePassword(value));
    }

    // Calculate password strength (keeping this for visual feedback)
    let strength = 0;
    if (value.length >= 8) strength++;
    if (/[A-Z]/.test(value)) strength++;
    if (/[a-z]/.test(value)) strength++;
    if (/[0-9]/.test(value)) strength++;
    if (/[!@#$%^&*]/.test(value)) strength++;
    setPasswordStrength(strength);
  };

  if (showLogin) {
    return (
      <Login
        onSwitchToSignup={toggleLoginSignup}
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
      {!verificationSent ? (
        <div
          className={`auth-container ${isClosing ? "closing" : ""}`}
          ref={modalRef}
          onClick={(e) => e.stopPropagation()}
        >
          <button className="login-close-button" onClick={handleClose}>
            &times;
          </button>
          <h1 className="title">Create Account</h1>
          <p className="subtitle">Join us to get started with your journey</p>

          <form onSubmit={handleEmailSignup} className="form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <div className="input-auth-container">
                <input
                  type="email"
                  value={email}
                  onChange={handleEmailChange}
                  placeholder="Enter your email"
                  required
                  className={`input ${emailError ? "input-error" : ""}`}
                />
              </div>
              {emailError && <div className="error-message">{emailError}</div>}
            </div>

            <div className="form-group">
              <label className="form-label">Create password</label>
              <div className="password-input-auth-container">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={handlePasswordChange}
                  placeholder="Enter your password"
                  required
                  className={`input ${passwordError ? "input-error" : ""}`}
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
              {passwordError && (
                <div className="error-message">{passwordError}</div>
              )}
              {hasStartedTyping && (
                <div className="password-strength-auth-container">
                  <div className="password-strength">
                    <div className="strength-label">
                      <span className="strength-text">Password Strength</span>
                      <span
                        className={`strength-value strength-${passwordStrength}`}
                      >
                        {passwordStrength === 0 && "Very Weak"}
                        {passwordStrength === 1 && "Weak"}
                        {passwordStrength === 2 && "Fair"}
                        {passwordStrength === 3 && "Good"}
                        {passwordStrength === 4 && "Strong"}
                        {passwordStrength === 5 && "Very Strong"}
                      </span>
                    </div>
                    <style jsx>{`
                      .password-strength-progress {
                        width: ${passwordStrength * 20}%;
                        --strength-color-start: ${passwordStrength <= 1
                          ? "#e74c3c"
                          : passwordStrength === 2
                          ? "#f39c12"
                          : passwordStrength === 3
                          ? "#f1c40f"
                          : passwordStrength === 4
                          ? "#2ecc71"
                          : "#27ae60"};
                        --strength-color-end: ${passwordStrength <= 1
                          ? "#c0392b"
                          : passwordStrength === 2
                          ? "#d35400"
                          : passwordStrength === 3
                          ? "#f39c12"
                          : passwordStrength === 4
                          ? "#27ae60"
                          : "#219a52"};
                      }
                    `}</style>
                    <div className="password-strength-bar">
                      <div className="password-strength-progress" />
                    </div>
                  </div>

                  <div className="requirements-auth-container">
                    <div
                      className={`requirement-tag ${
                        password.length >= 8 ? "met" : "unmet"
                      }`}
                    >
                      {password.length >= 8 ? <FaCheckCircle /> : <FaTimes />}
                      <span>8+ chars</span>
                    </div>
                    <div
                      className={`requirement-tag ${
                        /[A-Z]/.test(password) ? "met" : "unmet"
                      }`}
                    >
                      {/[A-Z]/.test(password) ? <FaCheckCircle /> : <FaTimes />}
                      <span>Uppercase</span>
                    </div>
                    <div
                      className={`requirement-tag ${
                        /[a-z]/.test(password) ? "met" : "unmet"
                      }`}
                    >
                      {/[a-z]/.test(password) ? <FaCheckCircle /> : <FaTimes />}
                      <span>Lowercase</span>
                    </div>
                    <div
                      className={`requirement-tag ${
                        /[0-9]/.test(password) ? "met" : "unmet"
                      }`}
                    >
                      {/[0-9]/.test(password) ? <FaCheckCircle /> : <FaTimes />}
                      <span>Number</span>
                    </div>
                    <div
                      className={`requirement-tag ${
                        /[!@#$%^&*]/.test(password) ? "met" : "unmet"
                      }`}
                    >
                      {/[!@#$%^&*]/.test(password) ? (
                        <FaCheckCircle />
                      ) : (
                        <FaTimes />
                      )}
                      <span>Special</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" className="button primary-button">
              <FaEnvelope className="button-icon" />
              <span>Sign Up with Email</span>
            </button>
          </form>

          <p className="login-prompt">
            Already have an account?{" "}
            <button onClick={toggleLoginSignup} className="switch-button">
              Log In
            </button>
          </p>

          {error && <div className="error">{error}</div>}
        </div>
      ) : (
        <div className="verification-modal">
          <div className="verification-content">
            <div className="verification-header">
              <div className="mail-icon-auth-container">
                <GmailIcon />
              </div>
              <h2>Verify your email</h2>
              <p className="email-display">{email}</p>
            </div>

            <div className="verification-body">
              <p>
                We've sent you a verification link. Please check your inbox and
                click the link to verify your account.
              </p>

              <div className="action-buttons">
                <button
                  className="primary-action"
                  onClick={handleResendVerification}
                  disabled={resendDisabled}
                >
                  {resendDisabled
                    ? `Resend in ${resendCooldown}s`
                    : "Resend email"}
                </button>

                <button
                  className="secondary-action"
                  onClick={() => window.open("https://gmail.com")}
                >
                  Open Gmail
                </button>
              </div>
            </div>

            <div className="verification-footer">
              <small>Can't find the email? Check your spam folder</small>
            </div>
          </div>
        </div>
      )}
      {showSuccessNotification && (
        <div className="success-notification">
          <FaCheckCircle className="icon" />
          <span className="message">Email verified successfully!</span>
        </div>
      )}
    </div>
  );
}
