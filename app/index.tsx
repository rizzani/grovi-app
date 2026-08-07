import { useEffect, useState } from "react";
import { Text, View, TouchableOpacity, StyleSheet, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { checkAuthStatus, hasLoggedInBefore } from "../lib/auth-service";
import * as SplashScreen from "expo-splash-screen";

// Keep the native splash screen visible while we check auth
SplashScreen.preventAutoHideAsync();

export default function WelcomeScreen() {
  const router = useRouter();
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const bootstrapAuth = async () => {
      try {
        // Show splash screen for 1.5 seconds
        await new Promise((resolve) => setTimeout(resolve, 1500));
        
        const result = await checkAuthStatus();
        
        // Hide native splash screen
        await SplashScreen.hideAsync();
        
        if (result.isAuthenticated) {
          // User is currently logged in - go directly to home
          router.replace("/home");
          return;
        }
        
        // User is not logged in - check if they've logged in before
        const hasLoggedIn = await hasLoggedInBefore();
        
        if (hasLoggedIn) {
          // Returning user - go directly to sign-in
          router.replace("/sign-in");
          return;
        }
        
        // New user - show welcome screen
        setShowSplash(false);
      } catch {
        // On error, hide splash and check if user has logged in before
        await SplashScreen.hideAsync();
        const hasLoggedIn = await hasLoggedInBefore();
        if (hasLoggedIn) {
          router.replace("/sign-in");
        } else {
          // New user - show welcome screen
          setShowSplash(false);
        }
      }
    };

    bootstrapAuth();
  }, [router]);

  // Show splash screen while checking
  if (showSplash) {
    return (
      <SafeAreaView style={styles.splashContainer}>
        <LinearGradient
          colors={["#065F46", "#D1FAE5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.gradient}
        >
          <View style={styles.splashContent}>
            {/* Logo */}
            <View style={styles.logoContainer}>
              <Image
                source={require("../assets/logo.png")}
                style={styles.logo}
                contentFit="contain"
              />
              <Text style={styles.logoText}>Grovi</Text>
            </View>

            {/* Tagline */}
            <Text style={styles.tagline}>Your Market, made simple</Text>

            {/* Decorative line */}
            <View style={styles.line} />
          </View>
        </LinearGradient>
      </SafeAreaView>
    );
  }

  // Show welcome screen for new users
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration Card */}
        <View style={styles.illustrationCard}>
          <Image
            source={require("../assets/grocery-illustration.png")}
            style={styles.illustrationImage}
            contentFit="cover"
          />
        </View>

        {/* Heading */}
        <Text style={styles.heading}>Your groceries, delivered</Text>

        {/* Description */}
        <Text style={styles.description}>
          Shop from your favorite local stores and get your groceries delivered in as little as an hour.
        </Text>

        {/* Buttons */}
        <View style={styles.buttonContainer}>
          {/* Sign In Button */}
          <TouchableOpacity 
            style={styles.signInButton}
            onPress={() => router.push("/sign-in")}
            activeOpacity={0.8}
          >
            <Text style={styles.signInButtonText}>Sign In</Text>
          </TouchableOpacity>

          {/* Sign Up Button */}
          <TouchableOpacity 
            style={styles.signUpButton}
            onPress={() => router.push("/sign-up")}
            activeOpacity={0.8}
          >
            <Text style={styles.signUpButtonText}>Sign Up</Text>
          </TouchableOpacity>

          {/* Continue as Guest */}
          <TouchableOpacity 
            style={styles.guestButton}
            activeOpacity={0.8}
          >
            <Text style={styles.guestButtonText}>Continue as Guest</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  splashContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 40,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 16,
  },
  logoText: {
    fontSize: 48,
    fontWeight: "bold",
    color: "#065F46",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 18,
    color: "#6B7280",
    fontWeight: "500",
    marginBottom: 20,
    textAlign: "center",
  },
  line: {
    width: "80%",
    height: 2,
    backgroundColor: "#065F46",
    marginTop: 20,
  },
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  illustrationCard: {
    backgroundColor: "#FEF3E2",
    borderRadius: 24,
    marginBottom: 32,
    overflow: "hidden",
    height: 340,
    width: "100%",
  },
  illustrationImage: {
    width: "100%",
    height: "100%",
  },
  heading: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#111827",
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    lineHeight: 24,
    marginBottom: 48,
    paddingHorizontal: 8,
  },
  buttonContainer: {
    gap: 16,
  },
  signInButton: {
    backgroundColor: "#10B981",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "bold",
  },
  signUpButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "#10B981",
  },
  signUpButtonText: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "600",
  },
  guestButton: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  guestButtonText: {
    color: "#6B7280",
    fontSize: 16,
    fontWeight: "500",
  },
});
