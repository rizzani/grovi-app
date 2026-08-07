import { useState, useEffect, useRef } from "react";
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
import { normalizePhoneNumber, validatePhoneNumber } from "../lib/phone-validation";
import {
  updatePhone,
  sendPhoneVerification,
  verifyPhone,
} from "../lib/auth-service";
import { account } from "../lib/appwrite-client";
import { createOrUpdateProfile } from "../lib/profile-service";
import { useUser } from "../contexts/UserContext";
import { logPhoneVerified } from "../lib/audit-service";

type Step = "phone" | "otp";

export default function PhoneVerification() {
  const router = useRouter();
  const { refreshSession } = useUser();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(["", "", "", "", "", ""]);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [focusedInput, setFocusedInput] = useState<"phone" | "password" | null>(null);
  const otpInputRefs = useRef<(TextInput | null)[]>([]);

  // Check if user already has a phone number set (coming from sign-up)
  useEffect(() => {
    const checkExistingPhone = async () => {
      try {
        const user = await account.get();
        
        // If user has a phone number, skip to OTP step
        if (user.phone) {
          setPhone(user.phone);
          setStep("otp");
          setIsLoading(true);
          
          // Automatically send verification code
          try {
            const result = await sendPhoneVerification();
            if (result.success) {
              setResendCooldown(60);
            } else {
              // If sending fails, go back to phone step
              setStep("phone");
              setPhoneError(result.error || "Failed to send verification code");
            }
          } catch {
            setStep("phone");
            setPhoneError("Failed to send verification code");
          } finally {
            setIsLoading(false);
          }
        }
      } catch {
        // User not authenticated or other error - stay on phone input step
        // This is fine, user will enter phone manually
      }
    };
    
    checkExistingPhone();
  }, []);

  // Countdown timer for resend
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => {
        setResendCooldown(resendCooldown - 1);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (phoneError) {
      setPhoneError(null);
    }
  };

  const handlePhoneFocus = () => {
    setFocusedInput("phone");
    setPhoneError(null);
    if (phone === "") {
      setPhone("+1876");
    }
  };

  const handlePhoneBlur = () => {
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
    if (passwordError) {
      setPasswordError(null);
    }
  };

  const handleSendVerification = async () => {
    // Validate phone
    const phoneValidation = validatePhoneNumber(phone);
    if (!phoneValidation.isValid) {
      setPhoneError(phoneValidation.error || "Invalid phone number");
      return;
    }

    if (!password.trim()) {
      setPasswordError("Password is required");
      return;
    }

    setPhoneError(null);
    setPasswordError(null);
    setIsLoading(true);

    try {
      const normalizedPhone = normalizePhoneNumber(phone);
      
      // Step 1: Update phone on account
      const updateResult = await updatePhone(normalizedPhone, password);
      
      if (!updateResult.success) {
        if (updateResult.error?.toLowerCase().includes("already registered")) {
          setPhoneError(updateResult.error);
        } else {
          setPhoneError(updateResult.error || "Failed to update phone number");
        }
        setIsLoading(false);
        return;
      }

      // Step 2: Send verification SMS
      const sendResult = await sendPhoneVerification();
      
      if (!sendResult.success) {
        setPhoneError(sendResult.error || "Failed to send verification code");
        setIsLoading(false);
        return;
      }

      // Success - move to OTP step
      setStep("otp");
      setResendCooldown(60); // 60 second cooldown
      setIsLoading(false);
    } catch (error) {
      setPhoneError("An unexpected error occurred. Please try again.");
      console.error("Phone verification error:", error);
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string, index: number) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) {
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    setOtpError(null);

    // Auto-focus next input
    if (value && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !otp[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async () => {
    const otpString = otp.join("");
    
    if (otpString.length !== 6) {
      setOtpError("Please enter the complete 6-digit code");
      return;
    }

    setOtpError(null);
    setIsLoading(true);

    try {
      const result = await verifyPhone(otpString);
      
      if (!result.success) {
        setOtpError(result.error || "Invalid verification code");
        setIsLoading(false);
        return;
      }

      // Phone verification successful - update profile with verified phone
      // Note: Profile is already created during sign-up, this just updates it
      try {
        const user = await account.get();
        
        // Split name into firstName and lastName if name exists
        let firstName: string | undefined;
        let lastName: string | undefined;
        if (user.name) {
          const parts = user.name.trim().split(/\s+/);
          if (parts.length === 1) {
            firstName = parts[0];
          } else if (parts.length > 1) {
            firstName = parts[0];
            lastName = parts.slice(1).join(" ");
          }
        }
        
        await createOrUpdateProfile({
          userId: user.$id,
          email: user.email,
          phone: user.phone || phone,
          firstName,
          lastName,
          name: user.name || undefined, // Keep for backward compatibility
        });

        // Log audit event (non-blocking)
        try {
          await logPhoneVerified(user.$id, user.phone || phone);
        } catch (auditError) {
          // Silently fail - audit logging should not break the flow
          console.warn("Failed to log audit event:", auditError);
        }
      } catch (profileError: any) {
        // Log error but don't block navigation - profile update can happen later
        console.warn("Failed to update profile with verified phone:", profileError.message);
      }

      // Success - refresh user context and navigate to home
      await refreshSession();
      router.replace("/home");
    } catch (error) {
      setOtpError("An unexpected error occurred. Please try again.");
      console.error("OTP verification error:", error);
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) {
      return;
    }

    setIsLoading(true);
    setOtpError(null);

    try {
      const result = await sendPhoneVerification();
      
      if (!result.success) {
        setOtpError(result.error || "Failed to resend code");
        setIsLoading(false);
        return;
      }

      setResendCooldown(60);
      setOtp(["", "", "", "", "", ""]);
      setIsLoading(false);
    } catch (error: any) {
      setOtpError("An unexpected error occurred. Please try again.");
      console.error("Resend error:", error);
      setIsLoading(false);
    }
  };

  const isPhoneStepValid = () => {
    const phoneValidation = validatePhoneNumber(phone);
    return phoneValidation.isValid && password.trim().length > 0;
  };

  const isOtpStepValid = () => {
    return otp.join("").length === 6;
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
              <Text style={styles.title}>
                {step === "phone" ? "Add Phone Number" : "Verify Phone Number"}
              </Text>
              <Text style={styles.subtitle}>
                {step === "phone"
                  ? "Add your phone number to your account"
                  : "Enter the 6-digit code sent to your phone"}
              </Text>
            </View>

            {step === "phone" ? (
              /* Phone Input Step */
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
                    editable={!isLoading}
                  />
                  {phoneError && (
                    <Text style={styles.errorText}>{phoneError}</Text>
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
                      placeholder="Password"
                      placeholderTextColor="#9CA3AF"
                      value={password}
                      onChangeText={handlePasswordChange}
                      secureTextEntry={!showPassword}
                      onFocus={() => {
                        setFocusedInput("password");
                        setPasswordError(null);
                      }}
                      onBlur={() => setFocusedInput(null)}
                      editable={!isLoading}
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
                  {passwordError && (
                    <Text style={styles.errorText}>{passwordError}</Text>
                  )}
                  <Text style={styles.passwordHint}>
                    Your password is required to update your phone number
                  </Text>
                </View>
              </View>
            ) : (
              /* OTP Verification Step */
              <View style={styles.inputContainer}>
                <View style={styles.otpContainer}>
                  {otp.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(ref) => {
                        otpInputRefs.current[index] = ref;
                      }}
                      style={[
                        styles.otpInput,
                        digit && styles.otpInputFilled,
                        otpError && styles.otpInputError,
                      ]}
                      value={digit}
                      onChangeText={(value) => handleOtpChange(value, index)}
                      onKeyPress={(e) => handleOtpKeyPress(e, index)}
                      keyboardType="number-pad"
                      maxLength={1}
                      editable={!isLoading}
                      selectTextOnFocus
                    />
                  ))}
                </View>
                {otpError && (
                  <Text style={styles.errorText}>{otpError}</Text>
                )}

                <View style={styles.resendContainer}>
                  <Text style={styles.resendText}>Didn&apos;t receive the code? </Text>
                  {resendCooldown > 0 ? (
                    <Text style={styles.resendCooldown}>
                      Resend in {resendCooldown}s
                    </Text>
                  ) : (
                    <TouchableOpacity
                      onPress={handleResend}
                      disabled={isLoading}
                    >
                      <Text style={styles.resendLink}>Resend Code</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {/* Action Button */}
            <TouchableOpacity
              style={[
                styles.continueButton,
                ((step === "phone" && !isPhoneStepValid()) ||
                  (step === "otp" && !isOtpStepValid()) ||
                  isLoading) &&
                  styles.continueButtonDisabled,
              ]}
              activeOpacity={0.8}
              disabled={
                (step === "phone" && !isPhoneStepValid()) ||
                (step === "otp" && !isOtpStepValid()) ||
                isLoading
              }
              onPress={step === "phone" ? handleSendVerification : handleVerify}
            >
              {isLoading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color="#FFFFFF" />
                  <Text style={styles.continueButtonText}>
                    {step === "phone" ? "Sending..." : "Verifying..."}
                  </Text>
                </View>
              ) : (
                <Text
                  style={[
                    styles.continueButtonText,
                    ((step === "phone" && !isPhoneStepValid()) ||
                      (step === "otp" && !isOtpStepValid()) ||
                      isLoading) &&
                      styles.continueButtonTextDisabled,
                  ]}
                >
                  {step === "phone" ? "Send Verification Code" : "Verify"}
                </Text>
              )}
            </TouchableOpacity>

            {/* Back Button */}
            {step === "otp" && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setStep("phone")}
                disabled={isLoading}
              >
                <Text style={styles.backButtonText}>Change Phone Number</Text>
              </TouchableOpacity>
            )}
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
  passwordHint: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 4,
    marginLeft: 4,
  },
  otpContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  otpInput: {
    flex: 1,
    height: 56,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    textAlign: "center",
    fontSize: 24,
    fontWeight: "bold",
    color: "#111827",
  },
  otpInputFilled: {
    borderColor: "#10B981",
  },
  otpInputError: {
    borderColor: "#EF4444",
  },
  resendContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
  },
  resendText: {
    color: "#6B7280",
    fontSize: 14,
  },
  resendLink: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  resendCooldown: {
    color: "#9CA3AF",
    fontSize: 14,
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
  backButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  backButtonText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
});

