import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useEffect, useState } from "react";
import {
  AudioModule,
  RecordingPresets,
  useAudioPlayer,
  useAudioRecorder,
} from "expo-audio";
import * as FileSystem from "expo-file-system";
import Ionicons from "@expo/vector-icons/Ionicons";

const STSConverter = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [audioUri, setAudioUri] = useState(null);
  const [hasPermission, setHasPermission] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState([]);
  const [currentlyPlaying, setCurrentlyPlaying] = useState(null);

  // Create a single audio player instance
  const player = useAudioPlayer(null);

  const STS_ENDPOINT = process.env.EXPO_PUBLIC_STS_URL;

  const recordingOptions = {
    ...RecordingPresets.HIGH_QUALITY,
    extension: ".wav",
    outputFormat: "wav",
    audioQuality: "high",
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 128000,
  };

  const audioRecorder = useAudioRecorder(recordingOptions);

  const playing = async (uri) => {
    try {
      // If already playing this URI, stop it
      if (currentlyPlaying === uri) {
        player.pause();
        setCurrentlyPlaying(null);
        return;
      }

      // If playing something else, stop it first
      if (currentlyPlaying) {
        player.pause();
      }

      // Load and play the new audio
      player.replace(uri);
      player.play();
      setCurrentlyPlaying(uri);
    } catch (error) {
      console.error("Playback error:", error);
      Alert.alert("Playback Error", "Failed to play the audio");
      setCurrentlyPlaying(null);
    }
  };

  useEffect(() => {
    const requestPermission = async () => {
      try {
        const status = await AudioModule.requestRecordingPermissionsAsync();
        setHasPermission(status.granted);
        if (!status.granted) {
          Alert.alert(
            "Permission Denied",
            "Microphone access is required for this app to work."
          );
        }
      } catch (error) {
        console.error("Permission error:", error);
        Alert.alert("Error", "Failed to request microphone permission.");
      }
    };

    requestPermission();

    return () => {
      if (isRecording) {
        audioRecorder.stop();
      }
      if (currentlyPlaying) {
        player.pause();
      }
    };
  }, []);

  const record = async () => {
    if (isRecording) {
      Alert.alert(
        "Already recording",
        "Please stop the current recording first."
      );
      return;
    }

    try {
      setIsLoading(false);
      setAudioUri(null);

      await audioRecorder.prepareToRecordAsync();
      await audioRecorder.record();
      setIsRecording(true);
    } catch (error) {
      console.error("Recording error:", error);
      Alert.alert(
        "Recording Failed",
        error.message || "Failed to start recording"
      );
    }
  };

  const stopRecording = async () => {
    try {
      await audioRecorder.stop();
      const uri = audioRecorder.uri;

      if (!uri) {
        throw new Error("No audio file was recorded");
      }

      setAudioUri(uri);
      setIsRecording(false);

      // Add the recorded message to the messages array
      const newMessage = {
        id: Date.now().toString(),
        uri: uri,
        type: "sent",
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
      console.log("Recording saved at", uri);
    } catch (error) {
      console.error("Stop recording error:", error);
      Alert.alert(
        "Recording Failed",
        error.message || "Failed to stop recording"
      );
    }
  };

  const speechToSpeech = async () => {
    if (!audioUri) {
      Alert.alert("No Audio", "Please record an audio file first.");
      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();
      formData.append("audio", {
        uri: audioUri,
        type: "audio/wav",
        name: `recording-${Date.now()}.wav`,
      });

      const response = await fetch(STS_ENDPOINT, {
        method: "POST",
        body: formData,
        headers: {
          Accept: "application/json",
          "Content-Type": "multipart/form-data",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Server responded with an error");
      }

      const data = await response.json();

      if (!data.audio) {
        throw new Error("No audio data received from the server");
      }
      const timestamp = Date.now();
      const fileName = `processed-${timestamp}.wav`;
      const fileUri = FileSystem.cacheDirectory + fileName;

      await FileSystem.writeAsStringAsync(fileUri, data.audio, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // Add the received message to the messages array
      const newMessage = {
        id: Date.now().toString(),
        uri: fileUri,
        type: "received",
        timestamp: new Date(),
      };

      setMessages((prevMessages) => [...prevMessages, newMessage]);
    } catch (error) {
      console.error("API Error:", error);
      Alert.alert(
        "Processing Error",
        error.message || "Failed to process audio"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const renderMessage = ({ item }) => {
    return (
      <View
        style={[
          styles.messageContainer,
          item.type === "sent" ? styles.sentMessage : styles.receivedMessage,
        ]}
      >
        <Pressable style={styles.playButton} onPress={() => playing(item.uri)}>
          <Ionicons
            name={currentlyPlaying === item.uri ? "pause" : "play"}
            size={24}
            color="white"
          />
        </Pressable>
        <Text style={styles.messageTime}>
          {item.timestamp.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </Text>
      </View>
    );
  };

  if (hasPermission === false) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          Microphone permission is required for this app to work.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Speech to Speech</Text>
      <Text style={styles.subtitle}>Record, convert, and play audio</Text>

      {/* Messages display area */}
      <View style={styles.messagesContainer}>
        <FlatList
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          inverted
        />
      </View>

      <View style={styles.mainButtonContainer}>
        <Pressable
          style={({ pressed }) => [
            styles.recordButton,
            isRecording && styles.recordingButton,
            pressed && styles.buttonPressed,
            hasPermission === false && styles.disabledButton,
          ]}
          onPress={isRecording ? stopRecording : record}
          disabled={hasPermission === false}
        >
          <Ionicons
            name={isRecording ? "stop" : "mic"}
            size={32}
            color="white"
          />
          <Text style={styles.recordButtonText}>
            {isRecording ? "Stop Recording" : "Start Recording"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.actionButton,
            styles.sendButton,
            (!audioUri || isRecording) && styles.disabledButton,
            pressed && styles.buttonPressed,
          ]}
          onPress={speechToSpeech}
          disabled={!audioUri || isRecording || isLoading}
        >
          {isLoading ? (
            <ActivityIndicator color="white" />
          ) : (
            <>
              <Ionicons name="send" size={24} color="white" />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f9fa",
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 5,
    color: "#333",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 20,
  },
  messagesContainer: {
    flex: 1,
    width: "100%",
    marginBottom: 20,
    backgroundColor: "#ff6b6b20",
    borderRadius: 30,
    padding: 20
  },
  messagesList: {
    paddingBottom: 20,
  },
  messageContainer: {
    maxWidth: "70%",
    padding: 12,
    borderRadius: 18,
    marginBottom: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  sentMessage: {
    alignSelf: "flex-end",
    backgroundColor: "#4263eb",
  },
  receivedMessage: {
    alignSelf: "flex-start",
    backgroundColor: "#7048e8",
  },
  playButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 10,
  },
  messageTime: {
    color: "white",
    fontSize: 12,
    opacity: 0.8,
  },
  waveformPlaceholder: {
    width: "100%",
    height: 80,
    backgroundColor: "#e9ecef",
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
    overflow: "hidden",
  },
  recordingIndicator: {
    width: "100%",
    height: "100%",
    backgroundColor: "#ff6b6b20",
  },
  mainButtonContainer: {
    width: "100%",
    marginBottom: 20,
    flexDirection: "row",
    justifyContent: "space-evenly",
  },
  recordButton: {
    backgroundColor: "#4263eb",
    paddingVertical: 20,
    paddingHorizontal: 30,
    borderRadius: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  recordingButton: {
    backgroundColor: "#f03e3e",
  },
  recordButtonText: {
    color: "white",
    fontSize: 18,
    fontWeight: "600",
  },
  actionButton: {
    flex: 1,
    maxWidth: 80,
    paddingVertical: 15,
    borderRadius: 60,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  sendButton: {
    backgroundColor: "#37b24b",
  },
  actionButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
    opacity: 0.8,
  },
  errorText: {
    color: "#f03e3e",
    fontSize: 16,
    textAlign: "center",
    padding: 20,
  },
});

export default STSConverter;
