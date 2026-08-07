import React, { useState, useRef, useCallback } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  StatusBar,
  Animated,
  FlatList,
  Text,
} from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import {
  GestureHandlerRootView,
  PinchGestureHandler,
  PinchGestureHandlerGestureEvent,
  PanGestureHandler,
  PanGestureHandlerGestureEvent,
  TapGestureHandler,
  TapGestureHandlerStateChangeEvent,
  State,
} from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ProductImageGalleryProps {
  /** Array of image URLs. If empty or undefined, shows placeholder */
  images?: string[];
  /** Alt text for accessibility */
  altText?: string;
  /** Show image counter (e.g., "1 / 3") */
  showCounter?: boolean;
}

/**
 * ProductImageGallery Component
 * 
 * Displays product images with the following features:
 * - Swipeable horizontal gallery for multiple images
 * - Tap to open full-screen view with zoom and pan
 * - Pinch to zoom in full-screen mode (1x to 4x)
 * - Drag to pan around zoomed images at any zoom level
 * - Double tap to zoom in/out (2.5x / 1x)
 * - Smooth animations with no auto-centering (stays where you zoom)
 * - Fallback placeholder for missing images
 * - Optimized for mobile bandwidth
 * 
 * @example
 * <ProductImageGallery 
 *   images={['url1', 'url2', 'url3']} 
 *   altText="Product Name"
 *   showCounter={true}
 * />
 */
export default function ProductImageGallery({
  images = [],
  altText = "Product image",
  showCounter = true,
}: ProductImageGalleryProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [fullScreenVisible, setFullScreenVisible] = useState(false);
  const [loadingImages, setLoadingImages] = useState<{ [key: number]: boolean }>({});
  const [isZoomed, setIsZoomed] = useState(false);
  const [showZoomIndicator, setShowZoomIndicator] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  
  // Zoom state for full-screen mode
  const scale = useRef(new Animated.Value(1)).current;
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const zoomIndicatorOpacity = useRef(new Animated.Value(0)).current;
  
  // Track the actual current values (not animated values)
  const currentScale = useRef(1);
  const currentTranslateX = useRef(0);
  const currentTranslateY = useRef(0);
  
  // Track pinch gesture state
  const pinchStartScale = useRef(1);
  
  // Track pan gesture state
  const panStartX = useRef(0);
  const panStartY = useRef(0);
  
  // Zoom indicator timeout
  const zoomIndicatorTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Gesture handler refs
  const doubleTapRef = useRef(null);
  const pinchRef = useRef(null);
  const panRef = useRef(null);
  
  // FlatList ref for syncing scroll between thumbnail and fullscreen
  const flatListRef = useRef<FlatList>(null);
  const fullScreenFlatListRef = useRef<FlatList>(null);

  const validImages = images.filter((img) => img && img.trim().length > 0);
  const hasImages = validImages.length > 0;

  // Helper function to constrain pan based on zoom level
  const constrainPan = (x: number, y: number, scaleValue: number) => {
    const maxTranslateX = scaleValue > 1 ? (SCREEN_WIDTH * (scaleValue - 1)) / 2 : 0;
    const maxTranslateY = scaleValue > 1 ? (SCREEN_HEIGHT * (scaleValue - 1)) / 2 : 0;
    
    return {
      x: Math.min(Math.max(x, -maxTranslateX), maxTranslateX),
      y: Math.min(Math.max(y, -maxTranslateY), maxTranslateY),
    };
  };

  // Show zoom level indicator (for final display with auto-hide)
  const displayZoomLevel = useCallback((level: number) => {
    setZoomLevel(level);
    setShowZoomIndicator(true);
    
    // Clear any existing timeout
    if (zoomIndicatorTimeout.current) {
      clearTimeout(zoomIndicatorTimeout.current);
    }
    
    // Fade in
    Animated.timing(zoomIndicatorOpacity, {
      toValue: 1,
      duration: 150,
      useNativeDriver: true,
    }).start();
    
    // Fade out after 1 second
    zoomIndicatorTimeout.current = setTimeout(() => {
      Animated.timing(zoomIndicatorOpacity, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setShowZoomIndicator(false);
      });
    }, 1000);
  }, [zoomIndicatorOpacity]);

  // Update zoom level continuously (for real-time display during gesture)
  const updateZoomLevelContinuous = useCallback((level: number) => {
    setZoomLevel(level);
    if (!showZoomIndicator) {
      setShowZoomIndicator(true);
      zoomIndicatorOpacity.setValue(1);
    }
  }, [showZoomIndicator, zoomIndicatorOpacity]);

  // Handle pinch gesture for zoom
  const onPinchGestureEvent = (event: PinchGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // Calculate new scale in real-time
      const newScale = Math.min(Math.max(pinchStartScale.current * event.nativeEvent.scale, 1), 4);
      
      // Update zoom indicator continuously during pinch
      updateZoomLevelContinuous(newScale);
      setIsZoomed(newScale > 1);
      
      // Calculate how much to adjust pan based on focal point and zoom change
      const scaleDiff = newScale / currentScale.current;
      
      // Adjust pan position to zoom into focal point
      // This makes it feel like you're zooming into where your fingers are
      const focalX = event.nativeEvent.focalX - SCREEN_WIDTH / 2;
      const focalY = event.nativeEvent.focalY - SCREEN_HEIGHT / 2;
      
      const newTranslateX = currentTranslateX.current - (focalX * (scaleDiff - 1));
      const newTranslateY = currentTranslateY.current - (focalY * (scaleDiff - 1));
      
      // Update animated values directly for smooth, real-time zoom
      scale.setValue(newScale);
      translateX.setValue(newTranslateX);
      translateY.setValue(newTranslateY);
      
      // Update current values
      currentScale.current = newScale;
      currentTranslateX.current = newTranslateX;
      currentTranslateY.current = newTranslateY;
    }
  };

  const onPinchHandlerStateChange = (event: PinchGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      pinchStartScale.current = currentScale.current;
      // Show zoom indicator immediately when pinch starts
      updateZoomLevelContinuous(currentScale.current);
    }
    
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      // Finalize zoom level
      const newScale = Math.min(Math.max(pinchStartScale.current * event.nativeEvent.scale, 1), 4);
      currentScale.current = newScale;
      setIsZoomed(newScale > 1);
      
      // Show final zoom level with auto-hide
      displayZoomLevel(newScale);
      
      // If zoomed all the way out, reset pan
      if (newScale === 1) {
        currentTranslateX.current = 0;
        currentTranslateY.current = 0;
        
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
        ]).start();
      } else {
        // Constrain pan within boundaries for new zoom level
        const constrained = constrainPan(
          currentTranslateX.current,
          currentTranslateY.current,
          newScale
        );
        
        // Only animate if we need to clamp
        if (constrained.x !== currentTranslateX.current || constrained.y !== currentTranslateY.current) {
          currentTranslateX.current = constrained.x;
          currentTranslateY.current = constrained.y;
          
          Animated.parallel([
            Animated.spring(translateX, {
              toValue: constrained.x,
              useNativeDriver: true,
              tension: 50,
              friction: 9,
            }),
            Animated.spring(translateY, {
              toValue: constrained.y,
              useNativeDriver: true,
              tension: 50,
              friction: 9,
            }),
          ]).start();
        }
      }
    }
  };

  // Handle pan gesture for moving zoomed image
  const onPanGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      // During active pan, update position based on start position + translation
      const newX = panStartX.current + event.nativeEvent.translationX;
      const newY = panStartY.current + event.nativeEvent.translationY;
      
      translateX.setValue(newX);
      translateY.setValue(newY);
    }
  };

  const onPanHandlerStateChange = (event: PanGestureHandlerGestureEvent) => {
    if (event.nativeEvent.state === State.BEGAN) {
      panStartX.current = currentTranslateX.current;
      panStartY.current = currentTranslateY.current;
      
      // Set current position as starting point
      translateX.setValue(currentTranslateX.current);
      translateY.setValue(currentTranslateY.current);
    }
    
    if (event.nativeEvent.state === State.END || event.nativeEvent.state === State.CANCELLED) {
      const newX = panStartX.current + event.nativeEvent.translationX;
      const newY = panStartY.current + event.nativeEvent.translationY;
      
      // Constrain within boundaries
      const constrained = constrainPan(newX, newY, currentScale.current);
      
      currentTranslateX.current = constrained.x;
      currentTranslateY.current = constrained.y;
      
      // Animate to constrained position if needed (only if clamping occurred)
      if (constrained.x !== newX || constrained.y !== newY) {
        Animated.parallel([
          Animated.spring(translateX, {
            toValue: constrained.x,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: constrained.y,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
        ]).start();
      } else {
        // No clamping needed, just update the values
        translateX.setValue(constrained.x);
        translateY.setValue(constrained.y);
      }
    }
  };

  // Handle double tap to toggle zoom
  const onDoubleTap = (event: TapGestureHandlerStateChangeEvent) => {
    if (event.nativeEvent.state === State.ACTIVE) {
      const isZoomed = currentScale.current > 1;
      const newScale = isZoomed ? 1 : 2.5;
      
      currentScale.current = newScale;
      setIsZoomed(newScale > 1);
      
      // Show zoom level indicator
      displayZoomLevel(newScale);
      
      if (newScale === 1) {
        // Zoom out - reset to center
        currentTranslateX.current = 0;
        currentTranslateY.current = 0;
        
        Animated.parallel([
          Animated.spring(scale, {
            toValue: 1,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
        ]).start();
      } else {
        // Zoom in - keep current pan position (don't reset)
        const constrained = constrainPan(
          currentTranslateX.current,
          currentTranslateY.current,
          newScale
        );
        
        currentTranslateX.current = constrained.x;
        currentTranslateY.current = constrained.y;
        
        Animated.parallel([
          Animated.spring(scale, {
            toValue: newScale,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateX, {
            toValue: constrained.x,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
          Animated.spring(translateY, {
            toValue: constrained.y,
            useNativeDriver: true,
            tension: 40,
            friction: 8,
          }),
        ]).start();
      }
    }
  };

  // Reset zoom and pan when closing full-screen
  const closeFullScreen = useCallback(() => {
    currentScale.current = 1;
    currentTranslateX.current = 0;
    currentTranslateY.current = 0;
    setIsZoomed(false);
    setShowZoomIndicator(false);
    
    // Clear zoom indicator timeout
    if (zoomIndicatorTimeout.current) {
      clearTimeout(zoomIndicatorTimeout.current);
      zoomIndicatorTimeout.current = null;
    }
    
    Animated.parallel([
      Animated.timing(scale, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateX, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(zoomIndicatorOpacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setFullScreenVisible(false);
    });
  }, [scale, translateX, translateY, zoomIndicatorOpacity]);

  // Open full-screen mode
  const openFullScreen = useCallback(() => {
    setFullScreenVisible(true);
    // Sync fullscreen gallery to current index
    setTimeout(() => {
      fullScreenFlatListRef.current?.scrollToIndex({
        index: currentIndex,
        animated: false,
      });
    }, 100);
  }, [currentIndex]);

  // Handle scroll in gallery
  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index || 0);
    }
  }).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  // Render individual image item
  const renderImageItem = ({ item, index }: { item: string; index: number }) => (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={openFullScreen}
      style={styles.imageSlide}
    >
      {loadingImages[index] && (
        <View style={styles.imagePlaceholderLoading}>
          <Ionicons name="image-outline" size={64} color="#D1D5DB" />
        </View>
      )}
      <Image
        source={{ uri: item }}
        style={styles.thumbnailImage}
        contentFit="contain"
        transition={200}
        cachePolicy="memory-disk"
        onLoadStart={() => setLoadingImages(prev => ({ ...prev, [index]: true }))}
        onLoad={() => setLoadingImages(prev => ({ ...prev, [index]: false }))}
        onError={(error) => {
          setLoadingImages(prev => ({ ...prev, [index]: false }));
          if (__DEV__) {
            console.error("Image failed to load:", item, error);
          }
        }}
        accessible={true}
        accessibilityLabel={`${altText}, image ${index + 1} of ${validImages.length}`}
      />
    </TouchableOpacity>
  );

  // Render full-screen image with zoom and pan
  const renderFullScreenImage = ({ item }: { item: string }) => (
    <View style={styles.fullScreenImageContainer}>
      <PinchGestureHandler
        ref={pinchRef}
        onGestureEvent={onPinchGestureEvent}
        onHandlerStateChange={onPinchHandlerStateChange}
        simultaneousHandlers={[panRef]}
      >
        <Animated.View style={{ flex: 1 }}>
          <PanGestureHandler
            ref={panRef}
            onGestureEvent={onPanGestureEvent}
            onHandlerStateChange={onPanHandlerStateChange}
            minPointers={1}
            maxPointers={2}
            simultaneousHandlers={[pinchRef]}
            avgTouches
          >
            <Animated.View style={{ flex: 1 }}>
              <TapGestureHandler
                ref={doubleTapRef}
                onHandlerStateChange={onDoubleTap}
                numberOfTaps={2}
              >
                <Animated.View
                  style={{
                    flex: 1,
                    justifyContent: 'center',
                    alignItems: 'center',
                  }}
                >
                  <Animated.View
                    style={{
                      transform: [
                        { translateX },
                        { translateY },
                        { scale },
                      ],
                    }}
                  >
                    <Image
                      source={{ uri: item }}
                      style={styles.fullScreenImage}
                      contentFit="contain"
                      transition={200}
                      cachePolicy="memory-disk"
                    />
                  </Animated.View>
                </Animated.View>
              </TapGestureHandler>
            </Animated.View>
          </PanGestureHandler>
        </Animated.View>
      </PinchGestureHandler>
    </View>
  );

  // If no images, show placeholder
  if (!hasImages) {
    return (
      <View style={styles.placeholderContainer}>
        <Ionicons name="image-outline" size={64} color="#D1D5DB" />
        <Text style={styles.placeholderText}>No image available</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Thumbnail Gallery */}
      <FlatList
        ref={flatListRef}
        data={validImages}
        renderItem={renderImageItem}
        keyExtractor={(item, index) => `thumbnail-${index}`}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        bounces={validImages.length > 1}
        scrollEnabled={validImages.length > 1}
      />

      {/* Image Counter */}
      {showCounter && validImages.length > 1 && (
        <View style={styles.counterContainer}>
          <Text style={styles.counterText}>
            {currentIndex + 1} / {validImages.length}
          </Text>
        </View>
      )}

      {/* Zoom Hint */}
      <View style={styles.zoomHint}>
        <Ionicons name="expand-outline" size={16} color="#6B7280" />
        <Text style={styles.zoomHintText}>Tap to zoom</Text>
      </View>

      {/* Full-Screen Modal */}
      <Modal
        visible={fullScreenVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={closeFullScreen}
      >
        <GestureHandlerRootView style={styles.fullScreenContainer}>
          <StatusBar hidden />
          
          {/* Close Button */}
          <TouchableOpacity
            style={styles.closeButton}
            onPress={closeFullScreen}
            activeOpacity={0.8}
          >
            <View style={styles.closeButtonBackground}>
              <Ionicons name="close" size={28} color="#FFFFFF" />
            </View>
          </TouchableOpacity>

          {/* Full-Screen Gallery */}
          <FlatList
            ref={fullScreenFlatListRef}
            data={validImages}
            renderItem={renderFullScreenImage}
            keyExtractor={(item, index) => `fullscreen-${index}`}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onViewableItemsChanged={onViewableItemsChanged}
            viewabilityConfig={viewabilityConfig}
            bounces={validImages.length > 1 && !isZoomed}
            scrollEnabled={validImages.length > 1 && !isZoomed}
            initialScrollIndex={currentIndex}
            getItemLayout={(data, index) => ({
              length: SCREEN_WIDTH,
              offset: SCREEN_WIDTH * index,
              index,
            })}
          />

          {/* Full-Screen Counter */}
          {validImages.length > 1 && (
            <View style={styles.fullScreenCounter}>
              <Text style={styles.fullScreenCounterText}>
                {currentIndex + 1} / {validImages.length}
              </Text>
            </View>
          )}

          {/* Zoom Instructions */}
          <View style={styles.fullScreenInstructions}>
            <Text style={styles.fullScreenInstructionsText}>
              Pinch to zoom • Drag to pan • Double tap to zoom
            </Text>
          </View>

          {/* Zoom Level Indicator */}
          {showZoomIndicator && (
            <Animated.View 
              style={[
                styles.zoomIndicator,
                { opacity: zoomIndicatorOpacity }
              ]}
            >
              <Text style={styles.zoomIndicatorText}>
                {zoomLevel.toFixed(1)}x
              </Text>
            </Animated.View>
          )}
        </GestureHandlerRootView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: 300,
    backgroundColor: "#FFFFFF",
    position: "relative",
  },
  imageSlide: {
    width: SCREEN_WIDTH,
    height: 300,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F9FAFB",
  },
  thumbnailImage: {
    width: "100%",
    height: "100%",
  },
  imagePlaceholderLoading: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1,
  },
  placeholderContainer: {
    width: "100%",
    height: 300,
    backgroundColor: "#F9FAFB",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    marginTop: 12,
    fontSize: 16,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  counterContainer: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  counterText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },
  zoomHint: {
    position: "absolute",
    bottom: 16,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  zoomHintText: {
    color: "#6B7280",
    fontSize: 12,
    fontWeight: "500",
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "#000000",
  },
  fullScreenImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  closeButton: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
  },
  closeButtonBackground: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  fullScreenCounter: {
    position: "absolute",
    bottom: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullScreenCounterText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  fullScreenInstructions: {
    position: "absolute",
    bottom: 50,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  fullScreenInstructionsText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },
  zoomIndicator: {
    position: "absolute",
    top: 100,
    alignSelf: "center",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  zoomIndicatorText: {
    color: "#FFFFFF",
    fontSize: 20,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});
