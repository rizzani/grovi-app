import { useState } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { normalizePhoneNumber, validatePhoneNumber } from "../lib/phone-validation";
import {
  validatePassword,
  validateConfirmPassword,
  getStrengthColor,
  getStrengthText,
  type PasswordStrength,
} from "../lib/password-validation";
import { signUp } from "../lib/auth-service";
import { useUser } from "../contexts/UserContext";

export default function SignUp() {
  const router = useRouter();
  const { refreshSession } = useUser();
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"phone" | "email" | "password" | "confirmPassword" | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState<ReturnType<typeof validatePassword>>({
    isValid: false,
    errors: [],
    strength: "weak",
    hints: [],
  });

  const handlePhoneChange = (text: string) => {
    // Allow free editing without forcing normalization during typing
    setPhone(text);
    
    // Clear error when user starts typing
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const handlePhoneFocus = () => {
    setFocusedInput("phone");
    setPhoneError(null);
    
    // Add +1876 prefix whenever field is empty on focus
    if (phone === "") {
      setPhone("+1876");
    }
  };

  const handlePhoneBlur = () => {
    // Normalize and validate on blur
    const normalized = normalizePhoneNumber(phone);
    setPhone(normalized);
    
    const validation = validatePhoneNumber(normalized);
    if (!validation.isValid) {
      setPhoneError(validation.error || "Invalid phone number");
    } else {
      setPhoneError(null);
    }
    setFocusedInput(null);
  };

  const handlePasswordChange = (text: string) => {
    setPassword(text);
    const validation = validatePassword(text);
    setPasswordValidation(validation);
    
    // Clear error when user starts typing
    if (passwordError) {
      setPasswordError(null);
    }

    // Validate confirm password if it's already filled
    if (confirmPassword) {
      const confirmValidation = validateConfirmPassword(text, confirmPassword);
      if (!confirmValidation.isValid) {
        setConfirmPasswordError(confirmValidation.error || null);
      } else {
        setConfirmPasswordError(null);
      }
    }
  };

  const handlePasswordBlur = () => {
    const validation = validatePassword(password);
    setPasswordValidation(validation);
    if (!validation.isValid && validation.errors.length > 0) {
      setPasswordError(validation.errors[0]);
    } else {
      setPasswordError(null);
    }
    setFocusedInput(null);
  };

  const handleConfirmPasswordChange = (text: string) => {
    setConfirmPassword(text);
    
    // Clear error when user starts typing
    if (confirmPasswordError) {
      setConfirmPasswordError(null);
    }

    // Validate match if password is filled
    if (password) {
      const validation = validateConfirmPassword(password, text);
      if (!validation.isValid) {
        setConfirmPasswordError(validation.error || null);
      } else {
        setConfirmPasswordError(null);
      }
    }
  };

  const handleConfirmPasswordBlur = () => {
    if (password) {
      const validation = validateConfirmPassword(password, confirmPassword);
      if (!validation.isValid) {
        setConfirmPasswordError(validation.error || null);
      } else {
        setConfirmPasswordError(null);
      }
    } else if (confirmPassword) {
      setConfirmPasswordError("Please enter password first");
    }
    setFocusedInput(null);
  };

  // Validate email format
  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  // Check if form is valid for submission
  const isFormValid = () => {
    const phoneValidation = validatePhoneNumber(phone);
    const emailValid = email.trim() !== "" && validateEmail(email);
    const passwordValid = passwordValidation.isValid;
    const confirmValid = validateConfirmPassword(password, confirmPassword).isValid;
    
    return phoneValidation.isValid && emailValid && passwordValid && confirmValid;
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate all fields before submission
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || "Invalid phone number");
      return;
    }

    if (!email.trim()) {
      setEmailError("Email is required");
      return;
    }

    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address");
      return;
    }

    const passwordValid = validatePassword(password);
    if (!passwordValid.isValid) {
      setPasswordError(passwordValid.errors[0] || "Invalid password");
      return;
    }

    const confirmValid = validateConfirmPassword(password, confirmPassword);
    if (!confirmValid.isValid) {
      setConfirmPasswordError(confirmValid.error || "Passwords do not match");
      return;
    }

    // Clear any previous errors
    setEmailError(null);
    setIsLoading(true);

    try {
      // Normalize phone number for API submission
      const normalizedPhone = normalizePhoneNumber(phone);
      
      // Create account and session
      const result = await signUp(email.trim(), password, normalizedPhone);

      if (result.success) {
        // Refresh user context after successful signup
        await refreshSession();

        // If phone was provided, redirect to phone verification
        // Otherwise, go to home (user is now authenticated)
        const normalizedPhone = normalizePhoneNumber(phone);
        if (phone && validatePhoneNumber(normalizedPhone).isValid) {
          router.push("/phone-verification");
        } else {
          router.replace("/home");
        }
      } else {
        // Handle errors - createAccount already returns the proper error message
        setEmailError(result.error || "Failed to create account. Please try again.");
      }
    } catch (error: any) {
      setEmailError("An unexpected error occurred. Please try again.");
      console.error("Sign up error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Image
                source={require("../assets/logo.png")}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.title}>Let&apos;s get you started</Text>
              <Text style={styles.subtitle}>Fresh groceries, fast delivery.</Text>
            </View>

            {/* Input Fields */}
            <View style={styles.inputContainer}>
              <View>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === "phone" && styles.inputFocused,
                    phoneError && styles.inputError,
                  ]}
                  placeholder="Phone (876-XXX-XXXX)"
                  placeholderTextColor="#9CA3AF"
                  value={phone}
                  onChangeText={handlePhoneChange}
                  keyboardType="phone-pad"
                  onFocus={handlePhoneFocus}
                  onBlur={handlePhoneBlur}
                />
                {phoneError && (
                  <Text style={styles.errorText}>{phoneError}</Text>
                )}
              </View>

              <View>
                <TextInput
                  style={[
                    styles.input,
                    focusedInput === "email" && styles.inputFocused,
                    emailError && styles.inputError,
                  ]}
                  placeholder="Email"
                  placeholderTextColor="#9CA3AF"
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    // Clear error when user starts typing
                    if (emailError) {
                      setEmailError(null);
                    }
                  }}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  onFocus={() => {
                    setFocusedInput("email");
                    setEmailError(null);
                  }}
                  onBlur={() => setFocusedInput(null)}
                  editable={!isLoading}
                />
                {emailError && (
                  <Text style={styles.errorText}>{emailError}</Text>
                )}
              </View>

              <View>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      focusedInput === "password" && styles.inputFocused,
                      passwordError && styles.inputError,
                    ]}
                    placeholder="Enter Password"
                    placeholderTextColor="#9CA3AF"
                    value={password}
                    onChangeText={handlePasswordChange}
                    secureTextEntry={!showPassword}
                    onFocus={() => {
                      setFocusedInput("password");
                      setPasswordError(null);
                    }}
                    onBlur={handlePasswordBlur}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowPassword(!showPassword)}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                
                {/* Password Strength Indicator */}
                {focusedInput === "password" && password.length > 0 && (
                  <View style={styles.strengthContainer}>
                    <View style={styles.strengthBarContainer}>
                      <View
                        style={[
                          styles.strengthBar,
                          {
                            width: `${passwordValidation.strength === "weak" ? 33 : passwordValidation.strength === "medium" ? 66 : 100}%`,
                            backgroundColor: getStrengthColor(passwordValidation.strength),
                          },
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.strengthText,
                        { color: getStrengthColor(passwordValidation.strength) },
                      ]}
                    >
                      {getStrengthText(passwordValidation.strength)}
                    </Text>
                  </View>
                )}

                {/* Password Validation Hints */}
                {focusedInput === "password" && password.length > 0 && passwordValidation.hints.length > 0 && (
                  <View style={styles.hintsContainer}>
                    {passwordValidation.hints.map((hint, index) => (
                      <View key={index} style={styles.hintRow}>
                        <Ionicons name="information-circle-outline" size={16} color="#6B7280" />
                        <Text style={styles.hintText}>{hint}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* Password Error Messages */}
                {passwordError && (
                  <Text style={styles.errorText}>{passwordError}</Text>
                )}
                
                {/* Password Requirements Checklist (when focused or has errors) */}
                {(focusedInput === "password" || passwordError) && password.length > 0 && (
                  <View style={styles.requirementsContainer}>
                    <View style={styles.requirementRow}>
                      <Ionicons
                        name={password.length >= 8 ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={password.length >= 8 ? "#10B981" : "#9CA3AF"}
                      />
                      <Text
                        style={[
                          styles.requirementText,
                          password.length >= 8 && styles.requirementMet,
                        ]}
                      >
                        At least 8 characters
                      </Text>
                    </View>
                    <View style={styles.requirementRow}>
                      <Ionicons
                        name={/\d/.test(password) ? "checkmark-circle" : "ellipse-outline"}
                        size={16}
                        color={/\d/.test(password) ? "#10B981" : "#9CA3AF"}
                      />
                      <Text
                        style={[
                          styles.requirementText,
                          /\d/.test(password) && styles.requirementMet,
                        ]}
                      >
                        At least one number
                      </Text>
                    </View>
                  </View>
                )}
              </View>

              <View>
                <View style={styles.passwordContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      styles.passwordInput,
                      focusedInput === "confirmPassword" && styles.inputFocused,
                      confirmPasswordError && styles.inputError,
                    ]}
                    placeholder="Confirm Password"
                    placeholderTextColor="#9CA3AF"
                    value={confirmPassword}
                    onChangeText={handleConfirmPasswordChange}
                    secureTextEntry={!showConfirmPassword}
                    onFocus={() => {
                      setFocusedInput("confirmPassword");
                      setConfirmPasswordError(null);
                    }}
                    onBlur={handleConfirmPasswordBlur}
                  />
                  <TouchableOpacity
                    style={styles.eyeIcon}
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    <Ionicons
                      name={showConfirmPassword ? "eye-off" : "eye"}
                      size={20}
                      color="#9CA3AF"
                    />
                  </TouchableOpacity>
                </View>
                {confirmPasswordError && (
                  <Text style={styles.errorText}>{confirmPasswordError}</Text>
                )}
              </View>
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                (!isFormValid() || isLoading) && styles.continueButtonDisabled,
              ]}
              activeOpacity={0.8}
              disabled={!isFormValid() || isLoading}
              onPress={handleSubmit}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.continueButtonText}>Creating account...</Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.continueButtonText,
                    (!isFormValid() || isLoading) && styles.continueButtonTextDisabled,
                  ]}
                >
                  Continue
                </Text>
              )}
            </TouchableOpacity>

            {/* Divider */}
            <View style={styles.dividerContainer}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>Or continue with</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Social Login Buttons */}
            <View style={styles.socialContainer}>
              <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <View style={styles.googleButtonWrapper}>
                  <View style={styles.googleGradientBackground}>
                    <Svg height="100%" width="100%" style={StyleSheet.absoluteFillObject}>
                      <Defs>
                        <LinearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <Stop offset="0%" stopColor="#EA4335" />
                          <Stop offset="25%" stopColor="#FBBC04" />
                          <Stop offset="50%" stopColor="#34A853" />
                          <Stop offset="75%" stopColor="#4285F4" />
                          <Stop offset="100%" stopColor="#EA4335" />
                        </LinearGradient>
                      </Defs>
                      <Rect width="100%" height="100%" rx="12" fill="url(#rainbowGradient)" />
                    </Svg>
                  </View>
                  <View style={styles.googleButtonInner}>
                    <View style={styles.googleIconContainer}>
                      <Image
                        source={require("../assets/google-logo.png")}
                        style={styles.googleLogo}
                        contentFit="contain"
                      />
                    </View>
                    <Text style={styles.socialButtonText}>Google</Text>
                  </View>
                </View>
              </TouchableOpacity>

              {/* Facebook button temporarily disabled */}
              {/* <TouchableOpacity style={styles.socialButton} activeOpacity={0.8}>
                <View style={styles.facebookButtonInner}>
                  <View style={styles.facebookIconContainer}>
                    <Image
                      source={require("../assets/facebook-logo.png")}
                      style={styles.facebookLogo}
                      contentFit="contain"
                    />
                  </View>
                  <Text style={styles.socialButtonText}>Facebook</Text>
                </View>
              </TouchableOpacity> */}
            </View>

            {/* Terms and Privacy */}
            <View style={styles.termsContainer}>
              <Text style={styles.termsText}>
                by Continue, you agree to our{" "}
                <Text style={styles.linkText} onPress={() => {}}>
                  Terms of Service
                </Text>
                {" "}and{" "}
                <Text style={styles.linkText} onPress={() => {}}>
                  Privacy Policy
                </Text>
              </Text>
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>You have an account? </Text>
              <TouchableOpacity onPress={() => router.push("/sign-in")}>
                <Text style={styles.signInText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "center",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 0,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 4,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  inputError: {
    borderColor: "#EF4444",
    marginBottom: 4,
  },
  errorText: {
    color: "#EF4444",
    fontSize: 12,
    marginBottom: 12,
    marginLeft: 4,
  },
  passwordContainer: {
    position: "relative",
  },
  passwordInput: {
    paddingRight: 50,
  },
  inputFocused: {
    borderColor: "#10B981",
  },
  eyeIcon: {
    position: "absolute",
    right: 16,
    top: 16,
  },
  continueButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 24,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  termsContainer: {
    marginBottom: 32,
  },
  termsText: {
    color: "#6B7280",
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  linkText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
  },
  signInText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  strengthContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  strengthBarContainer: {
    flex: 1,
    height: 4,
    backgroundColor: "#E5E7EB",
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
    minWidth: 50,
  },
  hintsContainer: {
    marginTop: 4,
    marginBottom: 8,
    paddingLeft: 4,
  },
  hintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  hintText: {
    fontSize: 12,
    color: "#6B7280",
  },
  requirementsContainer: {
    marginTop: 8,
    marginBottom: 12,
    paddingLeft: 4,
  },
  requirementRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  requirementText: {
    fontSize: 12,
    color: "#6B7280",
  },
  requirementMet: {
    color: "#10B981",
  },
  continueButtonDisabled: {
    backgroundColor: "#D1D5DB",
    opacity: 0.6,
  },
  continueButtonTextDisabled: {
    color: "#9CA3AF",
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 24,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#E5E7EB",
  },
  dividerText: {
    color: "#6B7280",
    fontSize: 14,
    marginHorizontal: 16,
  },
  socialContainer: {
    marginBottom: 24,
  },
  socialButton: {
    width: "100%",
  },
  // Google button with rainbow gradient border effect
  googleButtonWrapper: {
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  googleGradientBackground: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 12,
  },
  googleButtonInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    margin: 1.5,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    position: "relative",
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  googleLogo: {
    width: 24,
    height: 24,
  },
  // Facebook button with blue border
  facebookButtonInner: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#1877F2",
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  facebookIconContainer: {
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  facebookLogo: {
    width: 24,
    height: 24,
  },
  socialButtonText: {
    color: "#374151",
    fontSize: 16,
    fontWeight: "500",
  },
});

