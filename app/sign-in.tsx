import { useState, useRef, useEffect } from "react";
import {
  Text,
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import Svg, { Defs, LinearGradient, Stop, Rect } from "react-native-svg";
import { createSession, sendPasswordReset } from "../lib/auth-service";
import { useUser } from "../contexts/UserContext";

export default function SignIn() {
  const router = useRouter();
  const { refreshSession } = useUser();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [focusedInput, setFocusedInput] = useState<"email" | "password" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const errorOpacity = useRef(new Animated.Value(0)).current;

  // Animate error message
  useEffect(() => {
    if (error) {
      Animated.timing(errorOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(errorOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [error, errorOpacity]);

  const handleSignIn = async () => {
    // Clear previous errors
    setError(null);

    // Basic validation
    if (!email.trim()) {
      setError("Please enter your email");
      return;
    }

    if (!password) {
      setError("Please enter your password");
      return;
    }

    setIsLoading(true);

    try {
      const result = await createSession(email.trim(), password);

      if (!result.success) {
        setError(result.error || "Invalid email or password");
        setIsLoading(false);
        return;
      }

      // Success - refresh user context and navigate to home
      await refreshSession();
      router.replace("/home");
    } catch {
      setError("Invalid email or password");
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!email.trim()) {
      setError("Please enter your email first");
      return;
    }

    setError(null);

    try {
      await sendPasswordReset(email.trim());
      // Success - silently send reset (non-enumerating, no user feedback)
    } catch {
      // Silently handle error (non-enumerating)
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Image
              source={require("../assets/logo.png")}
              style={styles.logo}
              contentFit="contain"
            />
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>sign in to continue your shopping</Text>
          </View>

          {/* Input Fields */}
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                focusedInput === "email" && styles.inputFocused,
              ]}
              placeholder="Email or phone"
              placeholderTextColor="#9CA3AF"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              onFocus={() => setFocusedInput("email")}
              onBlur={() => setFocusedInput(null)}
            />

            <View style={styles.passwordContainer}>
              <TextInput
                style={[
                  styles.input,
                  styles.passwordInput,
                  focusedInput === "password" && styles.inputFocused,
                ]}
                placeholder="Password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                onFocus={() => setFocusedInput("password")}
                onBlur={() => setFocusedInput(null)}
              />
              {focusedInput === "password" && (
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                >
                  <Ionicons
                    name={showPassword ? "eye-off" : "eye"}
                    size={20}
                    color="#10B981"
                  />
                </TouchableOpacity>
              )}
            </View>

            {/* Forget Password */}
            <View style={styles.forgetPasswordContainer}>
              <Text style={styles.forgetPasswordText}>Forget password? </Text>
              <TouchableOpacity onPress={handlePasswordReset}>
                <Text style={styles.resetText}>Reset</Text>
              </TouchableOpacity>
            </View>

            {/* Error Message */}
            {error && (
              <Animated.View
                style={[
                  styles.errorContainer,
                  {
                    opacity: errorOpacity,
                    transform: [
                      {
                        translateY: errorOpacity.interpolate({
                          inputRange: [0, 1],
                          outputRange: [-10, 0],
                        }),
                      },
                    ],
                  },
                ]}
              >
                <View style={styles.errorContent}>
                  <Ionicons name="alert-circle" size={16} color="#DC2626" />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              </Animated.View>
            )}
          </View>

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              isLoading && styles.continueButtonDisabled,
            ]}
            onPress={handleSignIn}
            disabled={isLoading}
            activeOpacity={0.8}
          >
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.continueButtonText}>Continue</Text>
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

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>New here? </Text>
            <TouchableOpacity onPress={() => router.push("/sign-up")}>
              <Text style={styles.createAccountText}>Create an account</Text>
            </TouchableOpacity>
          </View>
        </View>
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
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
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
  },
  subtitle: {
    fontSize: 16,
    color: "#6B7280",
  },
  inputContainer: {
    marginBottom: 24,
  },
  input: {
    backgroundColor: "#F9FAFB",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    color: "#111827",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
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
  forgetPasswordContainer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    marginTop: 8,
  },
  forgetPasswordText: {
    color: "#6B7280",
    fontSize: 14,
  },
  resetText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  errorContainer: {
    marginTop: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FEF2F2",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#FEE2E2",
    overflow: "hidden",
  },
  errorText: {
    color: "#DC2626",
    fontSize: 14,
    flex: 1,
  },
  continueButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    marginBottom: 32,
  },
  continueButtonDisabled: {
    opacity: 0.6,
  },
  continueButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
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
    marginBottom: 32,
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
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    color: "#6B7280",
    fontSize: 14,
  },
  createAccountText: {
    color: "#10B981",
    fontSize: 14,
    fontWeight: "500",
  },
  errorContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
});
