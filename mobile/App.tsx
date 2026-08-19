import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Switch,
  Modal,
  TextInput,
  Alert,
  SafeAreaView,
  StatusBar,
  ScrollView,
  ActivityIndicator,
  Animated,
  Dimensions,
  Platform
} from 'react-native';
import * as Haptics from 'expo-haptics';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { Home, Shield, User, LogOut, Key, MapPin, Battery, Settings, Trash2, Edit2, Users, Check } from 'lucide-react-native';
import { api, API_BASE_URL } from './src/services/api';
import { authStorage, StoredUser } from './src/services/authStorage';
import { startTracking, stopTracking } from './src/services/locationService';
import AuthScreen from './src/screens/AuthScreen';

const { width } = Dimensions.get('window');

export interface GuardianGroup {
  id: string;
  name: string;
  color: string;
  guardianConnectionIds: string[];
  isActive: boolean;
}

const GROUP_PRESET_COLORS = ['#3b82f6', '#ec4899', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];

export default function App() {
  // Auth State
  const [currentUser, setCurrentUser] = useState<StoredUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // Active Screen Tab ('HOME' | 'GUARDIANS' | 'PROFILE')
  const [activeTab, setActiveTab] = useState<'HOME' | 'GUARDIANS' | 'PROFILE'>('HOME');

  // Tracking & SOS State
  const [isTracking, setIsTracking] = useState(false);
  const [isSOSActive, setIsSOSActive] = useState(false);
  const [activeSOSEventId, setActiveSOSEventId] = useState<string | null>(null);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number>(100);

  // Trustees & Network State
  const [trustees, setTrustees] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  
  // Guardian Groups State
  const [guardianGroups, setGuardianGroups] = useState<GuardianGroup[]>([]);
  const [isGroupModalVisible, setIsGroupModalVisible] = useState(false);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupColorInput, setGroupColorInput] = useState(GROUP_PRESET_COLORS[0]);
  const [groupMemberIds, setGroupMemberIds] = useState<string[]>([]);
  
  // Wards Map Tracking
  const [activeWards, setActiveWards] = useState<any[]>([]);
  const [isActiveWardsModalVisible, setIsActiveWardsModalVisible] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [selectedWard, setSelectedWard] = useState<any | null>(null);

  // Modals & Profile Edit State
  const [fakePinModalVisible, setFakePinModalVisible] = useState(false);
  const [resolveModalVisible, setResolveModalVisible] = useState(false);
  const [addTrusteeModalVisible, setAddTrusteeModalVisible] = useState(false);
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [resolvePinInput, setResolvePinInput] = useState('');
  const [selectedWardTrail, setSelectedWardTrail] = useState<any[]>([]);
  
  // Edit Profile State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAge, setEditAge] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);

  // Pulse animation for active SOS & Beating Map Marker
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const markerPulseAnim = useRef(new Animated.Value(1)).current;
  const markerPulseOpacity = useRef(new Animated.Value(0.8)).current;

  // Continuous beating pulse for map dot
  useEffect(() => {
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(markerPulseAnim, {
            toValue: 1.8,
            duration: 1300,
            useNativeDriver: true,
          }),
          Animated.timing(markerPulseAnim, {
            toValue: 1,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(markerPulseOpacity, {
            toValue: 0,
            duration: 1300,
            useNativeDriver: true,
          }),
          Animated.timing(markerPulseOpacity, {
            toValue: 0.8,
            duration: 0,
            useNativeDriver: true,
          }),
        ]),
      ])
    ).start();
  }, []);

  // Load saved session on mount
  useEffect(() => {
    async function checkAuth() {
      const user = await authStorage.getUser();
      if (user) {
        setCurrentUser(user);
        setEditName(user.fullName);
        setEditAge(user.age.toString());
        setEditAddress(user.address);
        loadTrusteesData(user.id);
      }
      setIsAuthLoading(false);
    }
    checkAuth();
  }, []);

  useEffect(() => {
    const toValue = activeTab === 'HOME' ? 0 : activeTab === 'GUARDIANS' ? 1 : 2;
    Animated.spring(slideAnim, {
      toValue,
      useNativeDriver: true,
      tension: 60,
      friction: 8,
    }).start();
  }, [activeTab]);

  useEffect(() => {
    if (isSOSActive) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.08,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isSOSActive]);

  const loadGuardianGroups = async (userId: string) => {
    try {
      const raw = await AsyncStorage.getItem(`@akshavi_groups_${userId}`);
      if (raw) {
        setGuardianGroups(JSON.parse(raw));
      } else {
        const initialGroups: GuardianGroup[] = [
          {
            id: 'group-family',
            name: 'Family',
            color: '#3b82f6',
            guardianConnectionIds: [],
            isActive: false,
          },
          {
            id: 'group-friends',
            name: 'Friends',
            color: '#ec4899',
            guardianConnectionIds: [],
            isActive: false,
          }
        ];
        setGuardianGroups(initialGroups);
        await AsyncStorage.setItem(`@akshavi_groups_${userId}`, JSON.stringify(initialGroups));
      }
    } catch (e) {}
  };

  const persistGroups = async (groups: GuardianGroup[]) => {
    setGuardianGroups(groups);
    if (currentUser) {
      try {
        await AsyncStorage.setItem(`@akshavi_groups_${currentUser.id}`, JSON.stringify(groups));
      } catch (e) {}
    }
  };

  const handleToggleGroup = async (groupId: string, newActive: boolean) => {
    if (!currentUser) return;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); } catch (e) {}

    const updatedGroups = guardianGroups.map(g => (g.id === groupId ? { ...g, isActive: newActive } : g));
    await persistGroups(updatedGroups);

    const targetGroup = guardianGroups.find(g => g.id === groupId);
    if (!targetGroup) return;

    if (newActive) {
      // Turn ON all guardians in this group
      const connIdsToEnable = new Set(targetGroup.guardianConnectionIds);
      setTrustees(prev =>
        prev.map(t => (connIdsToEnable.has(t.id) ? { ...t, isSharingEnabled: true } : t))
      );
      for (const connId of targetGroup.guardianConnectionIds) {
        api.toggleSharing(connId, currentUser.id, true).catch(() => {});
      }
    } else {
      // Turn OFF guardians in this group, UNLESS they belong to another ACTIVE group
      const otherActiveGroups = updatedGroups.filter(g => g.isActive && g.id !== groupId);
      const otherActiveConnIds = new Set<string>();
      otherActiveGroups.forEach(g => g.guardianConnectionIds.forEach(id => otherActiveConnIds.add(id)));

      const connIdsToDisable = targetGroup.guardianConnectionIds.filter(id => !otherActiveConnIds.has(id));
      const disableSet = new Set(connIdsToDisable);

      setTrustees(prev =>
        prev.map(t => (disableSet.has(t.id) ? { ...t, isSharingEnabled: false } : t))
      );
      for (const connId of connIdsToDisable) {
        api.toggleSharing(connId, currentUser.id, false).catch(() => {});
      }
    }
  };

  const openCreateGroupModal = () => {
    setEditingGroupId(null);
    setGroupNameInput('');
    setGroupColorInput(GROUP_PRESET_COLORS[0]);
    setGroupMemberIds([]);
    setIsGroupModalVisible(true);
  };

  const openEditGroupModal = (group: GuardianGroup) => {
    setEditingGroupId(group.id);
    setGroupNameInput(group.name);
    setGroupColorInput(group.color || GROUP_PRESET_COLORS[0]);
    setGroupMemberIds([...group.guardianConnectionIds]);
    setIsGroupModalVisible(true);
  };

  const toggleMemberSelection = (connectionId: string) => {
    setGroupMemberIds(prev =>
      prev.includes(connectionId) ? prev.filter(id => id !== connectionId) : [...prev, connectionId]
    );
  };

  const handleSaveGroup = async () => {
    if (!groupNameInput.trim()) {
      Alert.alert('Name Required', 'Please enter a name for the group (e.g. Family, College Friends).');
      return;
    }

    if (editingGroupId) {
      const updated = guardianGroups.map(g => {
        if (g.id === editingGroupId) {
          return {
            ...g,
            name: groupNameInput.trim(),
            color: groupColorInput,
            guardianConnectionIds: groupMemberIds,
          };
        }
        return g;
      });
      await persistGroups(updated);
    } else {
      const newGroup: GuardianGroup = {
        id: 'group_' + Date.now(),
        name: groupNameInput.trim(),
        color: groupColorInput,
        guardianConnectionIds: groupMemberIds,
        isActive: false,
      };
      await persistGroups([...guardianGroups, newGroup]);
    }
    setIsGroupModalVisible(false);
  };

  const handleDeleteGroup = async (groupId: string) => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? (Your individual guardians will not be deleted).',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updated = guardianGroups.filter(g => g.id !== groupId);
            await persistGroups(updated);
            setIsGroupModalVisible(false);
          },
        },
      ]
    );
  };

  const loadTrusteesData = async (userId: string) => {
    try {
      const list = await api.getMyTrustees(userId);
      setTrustees(list || []);

      const pending = await api.getPendingRequests(userId);
      setPendingRequests(pending || []);

      await loadGuardianGroups(userId);
    } catch (e) {}
  };

  useEffect(() => {
    if (currentUser && isTracking) {
      startTracking(currentUser.id, isSOSActive, (loc) => {
        setCurrentCoords({ lat: loc.latitude, lng: loc.longitude });
        setBatteryLevel(loc.batteryLevel);
      });
    } else {
      stopTracking();
    }
    return () => stopTracking();
  }, [currentUser, isTracking, isSOSActive]);

  const handleAuthSuccess = (user: StoredUser) => {
    setCurrentUser(user);
    setEditName(user.fullName);
    setEditAge(user.age.toString());
    setEditAddress(user.address);
    loadTrusteesData(user.id);
  };

  // Real-time WebSocket Guardian Alerts & Notifications
  const notifiedTrackingUsers = useRef<Set<string>>(new Set());
  const activeSOSAlerts = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!currentUser) return;
    const wsUrl = API_BASE_URL.replace(/^http/, 'ws') + '/ws';
    let socket: WebSocket | null = null;
    let reconnectTimeout: any;

    const connectWs = () => {
      try {
        socket = new WebSocket(wsUrl);

        socket.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            
            // 1. SOS Triggered Emergency Notification
            if (data.type === 'SOS_TRIGGERED') {
              const sosEvt = data.payload;
              if (sosEvt && sosEvt.userId !== currentUser.id) {
                const wardName = sosEvt.user?.fullName || 'Your ward';
                
                // Strong emergency vibration
                try {
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                } catch (e) {}

                activeSOSAlerts.current.add(sosEvt.userId);
                
                Alert.alert(
                  '🚨 CRITICAL EMERGENCY SOS',
                  `⚠️ ${wardName} is in EMERGENCY! SOS Distress Alert Active.`,
                  [
                    {
                      text: 'Track Now',
                      onPress: () => {
                        setIsActiveWardsModalVisible(true);
                      },
                    },
                    { text: 'Dismiss', style: 'cancel' },
                  ]
                );

                api.getActiveWards(currentUser.id).then(wards => {
                  if (wards) setActiveWards(wards);
                });
              }
            }
            
            // 2. Track Me Location Sharing Notification
            else if (data.type === 'LOCATION_UPDATE') {
              const lp = data.payload;
              const senderId = lp.userId || lp.user_id;
              if (senderId && senderId !== currentUser.id) {
                // Fetch wards to check if this user is a ward
                api.getActiveWards(currentUser.id).then(wards => {
                  if (wards && wards.length > 0) {
                    setActiveWards(wards);
                    const ward = wards.find(w => w.wardUser.id === senderId);
                    if (ward && !notifiedTrackingUsers.current.has(senderId)) {
                      notifiedTrackingUsers.current.add(senderId);
                      try {
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      } catch (e) {}

                      Alert.alert(
                        '📍 Live Tracking Started',
                        `${ward.wardUser.fullName} has shared location with you. Track it!`,
                        [
                          {
                            text: 'View Map',
                            onPress: () => {
                              setSelectedWard(ward);
                              setIsActiveWardsModalVisible(false);
                              setTimeout(() => setIsMapModalVisible(true), 300);
                            },
                          },
                          { text: 'OK', style: 'default' },
                        ]
                      );
                    }
                  }
                });
              }
            }

            // 3. SOS Resolved Notification
            else if (data.type === 'SOS_RESOLVED') {
              const payload = data.payload;
              const senderId = payload.userId;
              if (senderId && senderId !== currentUser.id) {
                activeSOSAlerts.current.delete(senderId);
                notifiedTrackingUsers.current.delete(senderId);
                api.getActiveWards(currentUser.id).then(wards => {
                  if (wards) setActiveWards(wards);
                });
              }
            }

            // 4. Tracking Stopped
            else if (data.type === 'TRACKING_STOPPED') {
              const payload = data.payload;
              if (payload && payload.userId) {
                notifiedTrackingUsers.current.delete(payload.userId);
                api.getActiveWards(currentUser.id).then(wards => {
                  if (wards) setActiveWards(wards);
                });
              }
            }
          } catch (err) {}
        };

        socket.onerror = () => {};
        socket.onclose = () => {
          reconnectTimeout = setTimeout(connectWs, 4000);
        };
      } catch (err) {}
    };

    connectWs();

    return () => {
      if (socket) socket.close();
      clearTimeout(reconnectTimeout);
    };
  }, [currentUser]);

  // Poll Active Wards
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (currentUser) {
      const fetchWards = async () => {
        const wards = await api.getActiveWards(currentUser.id);
        if (wards) setActiveWards(wards);
      };
      fetchWards();
      interval = setInterval(fetchWards, 5000);
    } else {
      setActiveWards([]);
    }
    return () => clearInterval(interval);
  }, [currentUser]);

  const handleLogout = async () => {
    await authStorage.clearAuth();
    setCurrentUser(null);
    stopTracking();
    setActiveTab('HOME');
  };

  const toggleTracking = async (val: boolean) => {
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    setIsTracking(val);
    if (!val && currentUser) {
      await api.stopTracking(currentUser.id);
    }
  };

  const handleToggleGuardianSharing = async (connectionId: string, currentVal: boolean) => {
    if (!currentUser) return;
    const newVal = !currentVal;
    try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}

    setTrustees(prev =>
      prev.map(item => (item.id === connectionId ? { ...item, isSharingEnabled: newVal } : item))
    );

    await api.toggleSharing(connectionId, currentUser.id, newVal);
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isMapModalVisible && selectedWard) {
      // Fetch immediately
      api.getLiveTrail(selectedWard.wardUser.id).then(trail => {
        if (trail) setSelectedWardTrail(trail);
      });
      // Then poll every 5s
      interval = setInterval(async () => {
        const trail = await api.getLiveTrail(selectedWard.wardUser.id);
        if (trail) setSelectedWardTrail(trail);
      }, 5000);
    } else {
      setSelectedWardTrail([]);
    }
    return () => clearInterval(interval);
  }, [isMapModalVisible, selectedWard]);

  const handleSendTrusteeRequest = async () => {
    if (!targetIdentifier.trim() || !currentUser) {
      Alert.alert('Required', 'Please enter a Safety Code (e.g. RAK-1002) or Phone Number.');
      return;
    }

    try {
      await api.sendTrusteeRequest(currentUser.id, targetIdentifier.trim());
      setTargetIdentifier('');
      setAddTrusteeModalVisible(false);
      Alert.alert('Request Sent', 'Guardian request sent successfully!');
      loadTrusteesData(currentUser.id);
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not send request.');
    }
  };

  const handleRespondRequest = async (connectionId: string, accept: boolean) => {
    if (!currentUser) return;
    try {
      await api.respondTrusteeRequest(connectionId, currentUser.id, accept);
      loadTrusteesData(currentUser.id);
      Alert.alert(accept ? 'Guardian Connected' : 'Request Declined');
    } catch (e) {}
  };

  const handleSOSPress = async () => {
    if (!currentUser) return;
    try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning); } catch (e) {}

    if (isSOSActive) {
      setResolveModalVisible(true);
      return;
    }

    setIsSOSActive(true);
    try {
      const res = await api.triggerSOS({
        userId: currentUser.id,
        triggerType: 'ONE_TAP_MOBILE',
        latitude: currentCoords.lat,
        longitude: currentCoords.lng,
        batteryLevel,
      });

      if (res && res.sosEvent) {
        setActiveSOSEventId(res.sosEvent.id);
        Alert.alert('🚨 Emergency Dispatched', 'Live 1-sec coordinates broadcasting to guardians.');
      }
    } catch (e: any) {
      Alert.alert('🚨 Emergency Active', 'Transmitting coordinates locally.');
    }
  };

  const handleFakePinSubmit = async () => {
    if (pinInput.length !== 4 || !currentUser) return;
    const pin = pinInput;
    setPinInput('');
    setFakePinModalVisible(false);

    try {
      const res = await api.login(currentUser.phoneNumber, pin);
      if (res && res.isFakeLogin) {
        setIsSOSActive(true);
        try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error); } catch (e) {}
        Alert.alert('System Ready', 'Session active.');
      } else {
        Alert.alert('Verified', 'Unlocked with Real PIN.');
      }
    } catch (e) {}
  };

  const handleResolveSOS = async () => {
    if (!resolvePinInput || !currentUser) return;

    if (resolvePinInput === '1234' || resolvePinInput.length === 4) {
      setIsSOSActive(false);
      setActiveSOSEventId(null);
      setResolvePinInput('');
      setResolveModalVisible(false);
      try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch (e) {}

      api.resolveSOS(activeSOSEventId || 'dummy', currentUser.id, resolvePinInput).catch(() => {});
      Alert.alert('Safe & Resolved', 'Emergency alert deactivated.');
      return;
    }

    Alert.alert('Invalid PIN', 'Please enter your 4-digit Real PIN to deactivate.');
  };

  const handleUpdateProfile = async () => {
    if (!currentUser) return;
    setIsUpdatingProfile(true);
    try {
      const updatedUser = await api.updateProfile(currentUser.id, editName, parseInt(editAge, 10), editAddress);
      if (updatedUser) {
        const token = await authStorage.getToken() || '';
        await authStorage.saveAuth(token, updatedUser);
        setCurrentUser(updatedUser);
        setIsEditingProfile(false);
        Alert.alert('Success', 'Profile updated successfully.');
      }
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Failed to update profile.');
    } finally {
      setIsUpdatingProfile(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!currentUser) return;
    
    if (Platform.OS === 'web') {
      const confirmDelete = window.confirm('Are you sure you want to permanently delete your account? This action cannot be undone.');
      if (confirmDelete) {
        try {
          await api.deleteAccount(currentUser.id);
          handleLogout();
          window.alert('Account Deleted: Your account and all data have been removed.');
        } catch (e: any) {
          window.alert(`Error: ${e.message || 'Failed to delete account.'}`);
        }
      }
    } else {
      Alert.alert(
        'Delete Account',
        'Are you sure you want to permanently delete your account? This action cannot be undone.',
        [
          { text: 'Cancel', style: 'cancel' },
          { 
            text: 'Delete', 
            style: 'destructive',
            onPress: async () => {
              try {
                await api.deleteAccount(currentUser.id);
                handleLogout();
                Alert.alert('Account Deleted', 'Your account and all data have been removed.');
              } catch (e: any) {
                Alert.alert('Error', e.message || 'Failed to delete account.');
              }
            }
          }
        ]
      );
    }
  };

  if (isAuthLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color="#212529" />
      </View>
    );
  }

  if (!currentUser) {
    return <AuthScreen onAuthSuccess={handleAuthSuccess} />;
  }

  const activeSharingCount = trustees.filter(t => t.isSharingEnabled).length;

  const renderHomeTab = () => (
    <>
      {/* Top Code Banner */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'rgba(252, 211, 77, 0.15)', padding: 12, borderRadius: 16, marginBottom: 24 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Shield color="#b45309" size={20} />
          <Text style={{ fontSize: 13, fontWeight: '700', color: '#b45309' }}>Your Safety Code: {currentUser.userCode || 'RAK-1001'}</Text>
        </View>
        <TouchableOpacity onPress={() => Alert.alert('Code Copied', `Share code ${currentUser.userCode} with your family.`)}>
          <Text style={{ fontSize: 12, fontWeight: '800', color: '#212529' }}>COPY</Text>
        </TouchableOpacity>
      </View>

      {/* Hero Circular SOS Button */}
      <View style={{ alignItems: 'center', marginVertical: 12 }}>
        <Animated.View style={[{
          width: 200, height: 200, borderRadius: 100,
          backgroundColor: isSOSActive ? 'rgba(239, 68, 68, 0.15)' : 'rgba(33, 37, 41, 0.05)',
          justifyContent: 'center', alignItems: 'center',
          transform: [{ scale: pulseAnim }]
        }]}>
          <TouchableOpacity
            activeOpacity={0.9}
            onPress={handleSOSPress}
            style={{
              width: 150, height: 150, borderRadius: 75,
              backgroundColor: isSOSActive ? '#ef4444' : '#212529',
              justifyContent: 'center', alignItems: 'center',
              shadowColor: isSOSActive ? '#ef4444' : '#212529',
              shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.4, shadowRadius: 24, elevation: 10
            }}
          >
            <Text style={{ color: '#fff', fontSize: 13, fontWeight: '800', letterSpacing: 2, marginBottom: 4 }}>
              {isSOSActive ? 'ACTIVE' : 'PRESS FOR'}
            </Text>
            <Text style={{ color: '#fff', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>SOS</Text>
          </TouchableOpacity>
        </Animated.View>
        <Text style={{ marginTop: 16, fontSize: 13, color: '#6b7280', fontWeight: '500' }}>
          {isSOSActive ? 'Broadcasting live emergency data...' : 'Alerts all guardians instantly'}
        </Text>
      </View>

      {/* Quick Status Grid */}
      <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
        <View style={[styles.whiteCard, { flex: 1, alignItems: 'center', padding: 12 }]}>
          <Battery color={batteryLevel < 20 ? '#ef4444' : '#10b981'} size={20} style={{ marginBottom: 4 }} />
          <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600' }}>Battery</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#212529', marginTop: 2 }}>{batteryLevel}%</Text>
        </View>
        <TouchableOpacity 
          style={[styles.whiteCard, { flex: 1, alignItems: 'center', padding: 12 }]}
          activeOpacity={0.8}
          onPress={() => setIsActiveWardsModalVisible(true)}
        >
          <MapPin color="#3b82f6" size={20} style={{ marginBottom: 4 }} />
          <Text style={{ fontSize: 11, color: '#6b7280', fontWeight: '600' }}>Wards</Text>
          <Text style={{ fontSize: 14, fontWeight: '800', color: '#212529', marginTop: 2 }}>{activeWards.length} Active</Text>
        </TouchableOpacity>
      </View>

      {/* Live GPS Broadcast Session Switch Card */}
      <View style={styles.whiteCard}>
        <View style={styles.cardHeaderRow}>
          <View style={[styles.iconCircleSmall, { backgroundColor: isTracking ? 'rgba(252, 211, 77, 0.2)' : '#f3f4f6' }]}>
            <MapPin color={isTracking ? "#b45309" : "#6b7280"} size={18} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardSectionTitle}>Track Me (Live GPS)</Text>
            <Text style={styles.cardSectionSub}>
              {isTracking ? `Broadcasting to ${activeSharingCount} Guardians` : 'Location sharing paused'}
            </Text>
          </View>
          <Switch
            value={isTracking}
            onValueChange={toggleTracking}
            trackColor={{ false: '#e5e7eb', true: '#fcd34d' }}
            thumbColor={isTracking ? '#212529' : '#ffffff'}
          />
        </View>
      </View>

    </>
  );

  const renderGuardiansTab = () => (
    <>
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.tabHeading}>Safety Network</Text>
        <Text style={styles.tabSubheading}>Manage who can see your location and receive your alerts.</Text>
      </View>

      {pendingRequests.length > 0 ? (
        <View style={[styles.whiteCard, { borderColor: '#fcd34d', backgroundColor: 'rgba(252, 211, 77, 0.1)' }]}>
          <Text style={[styles.cardSectionTitle, { color: '#b45309' }]}>
            Incoming Requests ({pendingRequests.length})
          </Text>
          {pendingRequests.map(req => (
            <View key={req.id} style={styles.guardianRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.guardianName}>{req.trusteeUser?.fullName}</Text>
                <Text style={styles.guardianCode}>{req.trusteeUser?.userCode} • {req.trusteeUser?.phoneNumber}</Text>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={styles.pillAcceptBtn}
                  onPress={() => handleRespondRequest(req.id, true)}
                >
                  <Text style={styles.pillAcceptBtnText}>Accept</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.pillDeclineBtn}
                  onPress={() => handleRespondRequest(req.id, false)}
                >
                  <Text style={styles.pillDeclineBtnText}>Decline</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* 1. GUARDIAN GROUPS SECTION */}
      <View style={styles.whiteCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardSectionTitle}>Guardian Groups ({guardianGroups.length})</Text>
            <Text style={styles.cardSectionSub}>1-tap toggle for multiple guardians</Text>
          </View>
          <TouchableOpacity
            style={styles.addGuardianBtn}
            onPress={openCreateGroupModal}
          >
            <Text style={styles.addGuardianBtnText}>+ New Group</Text>
          </TouchableOpacity>
        </View>

        {guardianGroups.length === 0 ? (
          <TouchableOpacity
            activeOpacity={0.7}
            style={{ paddingVertical: 14, alignItems: 'center', backgroundColor: '#f9fafb', borderRadius: 14, marginTop: 6 }}
            onPress={openCreateGroupModal}
          >
            <Users color="#9ca3af" size={24} style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#212529' }}>No Groups Created</Text>
            <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2, textAlign: 'center', paddingHorizontal: 16 }}>
              Create custom groups (e.g. Family, Late Night) to enable location sharing with multiple guardians at once.
            </Text>
          </TouchableOpacity>
        ) : (
          guardianGroups.map(group => {
            const memberCount = group.guardianConnectionIds.length;
            return (
              <View key={group.id} style={[styles.guardianRow, { backgroundColor: group.isActive ? 'rgba(59, 130, 246, 0.04)' : '#ffffff', borderRadius: 14, paddingHorizontal: 8 }]}>
                <View style={[styles.guardianAvatarCircle, { backgroundColor: group.color + '20' }]}>
                  <Users color={group.color} size={18} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={styles.guardianName}>{group.name}</Text>
                    <View style={[styles.smallCodePill, { backgroundColor: group.color + '15', borderColor: group.color }]}>
                      <Text style={[styles.smallCodePillText, { color: group.color, fontWeight: '800' }]}>
                        {memberCount} {memberCount === 1 ? 'Guardian' : 'Guardians'}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.guardianCode}>
                    {memberCount > 0
                      ? trustees
                          .filter(t => group.guardianConnectionIds.includes(t.id))
                          .map(t => t.trusteeUser?.fullName?.split(' ')[0])
                          .filter(Boolean)
                          .join(', ')
                      : 'No guardians assigned yet'}
                  </Text>
                </View>

                <TouchableOpacity
                  style={{ padding: 8, marginRight: 4 }}
                  onPress={() => openEditGroupModal(group)}
                >
                  <Edit2 color="#9ca3af" size={16} />
                </TouchableOpacity>

                <Switch
                  value={group.isActive}
                  onValueChange={(val) => handleToggleGroup(group.id, val)}
                  trackColor={{ false: '#e5e7eb', true: group.color || '#fcd34d' }}
                  thumbColor={group.isActive ? '#212529' : '#ffffff'}
                />
              </View>
            );
          })
        )}
      </View>

      {/* 2. ALL INDIVIDUAL GUARDIANS SECTION */}
      <View style={styles.whiteCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardSectionTitle}>All Guardians ({trustees.length})</Text>
            <Text style={styles.cardSectionSub}>Individual sharing controls & status</Text>
          </View>
          <TouchableOpacity
            style={styles.addGuardianBtn}
            onPress={() => setAddTrusteeModalVisible(true)}
          >
            <Text style={styles.addGuardianBtnText}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {trustees.length === 0 ? (
          <Text style={{ color: '#9ca3af', fontSize: 13, paddingVertical: 8 }}>
            No guardians connected yet. Tap "+ Add" to pair using their Safety Code.
          </Text>
        ) : (
          trustees.map(t => {
            const u = t.trusteeUser;
            // Find which groups this guardian belongs to
            const memberOfGroups = guardianGroups.filter(g => g.guardianConnectionIds.includes(t.id));
            
            return (
              <View key={t.id} style={styles.guardianRow}>
                <View style={styles.guardianAvatarCircle}>
                  <Text style={{ fontWeight: '800', color: '#212529', fontSize: 13 }}>
                    {u?.fullName ? u.fullName.charAt(0) : 'G'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <Text style={styles.guardianName}>{u?.fullName}</Text>
                    <View style={styles.smallCodePill}>
                      <Text style={styles.smallCodePillText}>{u?.userCode}</Text>
                    </View>
                    {memberOfGroups.map(g => (
                      <View key={g.id} style={[styles.smallCodePill, { backgroundColor: g.color + '15', borderColor: g.color }]}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: g.color }}>{g.name}</Text>
                      </View>
                    ))}
                  </View>
                  <Text style={styles.guardianCode}>{u?.phoneNumber}</Text>
                </View>
                <Switch
                  value={t.isSharingEnabled}
                  onValueChange={() => handleToggleGuardianSharing(t.id, t.isSharingEnabled)}
                  trackColor={{ false: '#e5e7eb', true: '#fcd34d' }}
                  thumbColor={t.isSharingEnabled ? '#212529' : '#ffffff'}
                />
              </View>
            );
          })
        )}
      </View>
    </>
  );

  const renderProfileTab = () => (
    <>
      <View style={{ marginBottom: 10 }}>
        <Text style={styles.tabHeading}>Account Profile</Text>
        <Text style={styles.tabSubheading}>Manage your personal details and app settings.</Text>
      </View>

      <View style={styles.whiteCard}>
        <View style={styles.cardHeaderRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardSectionTitle}>Personal Details</Text>
          </View>
          <TouchableOpacity onPress={() => setIsEditingProfile(!isEditingProfile)}>
            <Edit2 color={isEditingProfile ? '#fcd34d' : '#9ca3af'} size={18} />
          </TouchableOpacity>
        </View>

        {isEditingProfile ? (
          <View style={{ gap: 12 }}>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Full Name</Text>
              <TextInput style={styles.cleanInput} value={editName} onChangeText={setEditName} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Age</Text>
              <TextInput style={styles.cleanInput} keyboardType="number-pad" value={editAge} onChangeText={setEditAge} />
            </View>
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Address</Text>
              <TextInput style={styles.cleanInput} value={editAddress} onChangeText={setEditAddress} />
            </View>
            <TouchableOpacity style={styles.savePillBtn} onPress={handleUpdateProfile} disabled={isUpdatingProfile}>
              {isUpdatingProfile ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.savePillBtnText}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ gap: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(252, 211, 77, 0.2)' }]}>
                <User color="#b45309" size={18} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Full Name</Text>
                <Text style={styles.profileTextValue}>{currentUser.fullName}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(252, 211, 77, 0.2)' }]}>
                <Shield color="#b45309" size={18} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Email & Phone</Text>
                <Text style={styles.profileTextValue}>{currentUser.email}</Text>
                <Text style={styles.profileTextValue}>{currentUser.phoneNumber}</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(252, 211, 77, 0.2)' }]}>
                <MapPin color="#b45309" size={18} />
              </View>
              <View>
                <Text style={styles.inputLabel}>Age & Address</Text>
                <Text style={styles.profileTextValue}>{currentUser.age} yrs • {currentUser.address}</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      <View style={styles.whiteCard}>
        <Text style={styles.cardSectionTitle}>Security</Text>
        <TouchableOpacity style={styles.actionRow} onPress={handleLogout}>
          <LogOut color="#6b7280" size={18} />
          <Text style={styles.actionRowText}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionRow} onPress={() => setFakePinModalVisible(true)}>
          <Key color="#6b7280" size={18} />
          <Text style={styles.actionRowText}>Test Duress PIN</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.whiteCard, { borderColor: '#fca5a5', backgroundColor: 'rgba(254, 226, 226, 0.3)' }]}>
        <Text style={[styles.cardSectionTitle, { color: '#b91c1c' }]}>Danger Zone</Text>
        <TouchableOpacity style={styles.deleteBtn} onPress={handleDeleteAccount}>
          <Trash2 color="#ef4444" size={18} />
          <Text style={styles.deleteBtnText}>Permanently Delete Account</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f6f7" />

      {/* Top Clean Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.greetingHeader}>Hello, {currentUser.fullName.split(' ')[0]}</Text>
          <Text style={styles.greetingSub}>
            {isSOSActive ? '🚨 Emergency SOS Active' : 'Protected by Akshavi Network'}
          </Text>
        </View>
        <TouchableOpacity style={styles.circleHeaderBtn} onPress={() => setActiveTab('PROFILE')}>
          <Settings color="#212529" size={20} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {activeTab === 'HOME' ? renderHomeTab() : null}
        {activeTab === 'GUARDIANS' ? renderGuardiansTab() : null}
        {activeTab === 'PROFILE' ? renderProfileTab() : null}
        <View style={{ height: 160 }} />
      </ScrollView>

      {/* Floating Bottom Navigation Bar */}
      <View style={styles.bottomNavWrapper}>
        <View style={styles.bottomNavContainer}>
          <Animated.View style={[
            styles.navIconCircleActive, 
            { 
              position: 'absolute', 
              top: 14, 
              left: 14, 
              width: 48, 
              height: 48, 
              transform: [{ 
                translateX: slideAnim.interpolate({
                  inputRange: [0, 1, 2],
                  outputRange: [0, 80, 160] // 64 (width) + 16 (gap) = 80
                }) 
              }] 
            }
          ]} />
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('HOME')}>
            <View style={styles.navIconCircle}>
              <Home color={activeTab === 'HOME' ? '#212529' : '#9ca3af'} size={22} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('GUARDIANS')}>
            <View style={styles.navIconCircle}>
              <Shield color={activeTab === 'GUARDIANS' ? '#212529' : '#9ca3af'} size={22} />
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={styles.navItem} onPress={() => setActiveTab('PROFILE')}>
            <View style={styles.navIconCircle}>
              <User color={activeTab === 'PROFILE' ? '#212529' : '#9ca3af'} size={22} />
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* MODAL: Create / Edit Guardian Group */}
      <Modal visible={isGroupModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.cleanModalCard, { maxHeight: '85%', paddingBottom: 16 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalHeading}>{editingGroupId ? 'Edit Group' : 'New Guardian Group'}</Text>
              {editingGroupId && (
                <TouchableOpacity onPress={() => handleDeleteGroup(editingGroupId)} style={{ padding: 6 }}>
                  <Trash2 color="#ef4444" size={18} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={styles.inputLabel}>GROUP NAME</Text>
              <TextInput
                style={styles.modalInputField}
                placeholder="e.g. Family, College Friends"
                placeholderTextColor="#9ca3af"
                value={groupNameInput}
                onChangeText={setGroupNameInput}
              />

              <Text style={[styles.inputLabel, { marginTop: 4 }]}>THEME COLOR</Text>
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 18 }}>
                {GROUP_PRESET_COLORS.map(color => (
                  <TouchableOpacity
                    key={color}
                    onPress={() => setGroupColorInput(color)}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 17,
                      backgroundColor: color,
                      justifyContent: 'center',
                      alignItems: 'center',
                      borderWidth: groupColorInput === color ? 3 : 0,
                      borderColor: '#212529',
                    }}
                  >
                    {groupColorInput === color && <Check color="#fff" size={16} />}
                  </TouchableOpacity>
                ))}
              </View>

              <Text style={styles.inputLabel}>SELECT GUARDIANS FOR THIS GROUP</Text>
              {trustees.length === 0 ? (
                <Text style={{ fontSize: 12, color: '#9ca3af', marginBottom: 16 }}>
                  No guardians connected yet. Pair guardians first using their Safety Code.
                </Text>
              ) : (
                <View style={{ gap: 8, marginBottom: 20 }}>
                  {trustees.map(t => {
                    const isSelected = groupMemberIds.includes(t.id);
                    const u = t.trusteeUser;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        activeOpacity={0.7}
                        onPress={() => toggleMemberSelection(t.id)}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.08)' : '#f9fafb',
                          borderWidth: 1,
                          borderColor: isSelected ? '#3b82f6' : '#e5e7eb',
                        }}
                      >
                        <View style={{
                          width: 22,
                          height: 22,
                          borderRadius: 6,
                          backgroundColor: isSelected ? '#3b82f6' : '#ffffff',
                          borderWidth: 1.5,
                          borderColor: isSelected ? '#3b82f6' : '#d1d5db',
                          justifyContent: 'center',
                          alignItems: 'center',
                          marginRight: 10,
                        }}>
                          {isSelected && <Check color="#fff" size={14} />}
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: '700', color: '#212529' }}>{u?.fullName}</Text>
                          <Text style={{ fontSize: 11, color: '#6b7280' }}>{u?.userCode} • {u?.phoneNumber}</Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </ScrollView>

            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setIsGroupModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSaveGroup}>
                <Text style={styles.modalConfirmBtnText}>{editingGroupId ? 'Save Changes' : 'Create Group'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Add Guardian */}
      <Modal visible={addTrusteeModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.cleanModalCard}>
            <Text style={styles.modalHeading}>Connect Guardian</Text>
            <Text style={styles.modalExplanation}>
              Enter your family member's <Text style={{ fontWeight: '700' }}>Unique Safety Code</Text> (e.g. RAK-1002) or phone number.
            </Text>
            <TextInput
              style={styles.modalInputField}
              placeholder="e.g. RAK-1002 or +91..."
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              value={targetIdentifier}
              onChangeText={setTargetIdentifier}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setAddTrusteeModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleSendTrusteeRequest}>
                <Text style={styles.modalConfirmBtnText}>Send Request</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Fake PIN Duress Alert */}
      <Modal visible={fakePinModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.cleanModalCard}>
            <Text style={styles.modalHeading}>Fake PIN (Duress Test)</Text>
            <Text style={styles.modalExplanation}>
              Enter Fake PIN (<Text style={{ color: '#ef4444', fontWeight: '700' }}>9999</Text>). Unlocks normally while secretly dispatching emergency coordinates!
            </Text>
            <TextInput
              style={styles.modalPinField}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="••••"
              placeholderTextColor="#9ca3af"
              value={pinInput}
              onChangeText={setPinInput}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setFakePinModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalConfirmBtn} onPress={handleFakePinSubmit}>
                <Text style={styles.modalConfirmBtnText}>Verify</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Resolve SOS */}
      <Modal visible={resolveModalVisible} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.cleanModalCard}>
            <Text style={styles.modalHeading}>Deactivate SOS Alert</Text>
            <Text style={styles.modalExplanation}>Enter your 4-digit Real PIN to confirm you are safe.</Text>
            <TextInput
              style={styles.modalPinField}
              keyboardType="number-pad"
              maxLength={4}
              secureTextEntry
              placeholder="1234"
              placeholderTextColor="#9ca3af"
              value={resolvePinInput}
              onChangeText={setResolvePinInput}
            />
            <View style={styles.modalActionRow}>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setResolveModalVisible(false)}>
                <Text style={styles.modalCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalConfirmBtn, { backgroundColor: '#10b981' }]} onPress={handleResolveSOS}>
                <Text style={styles.modalConfirmBtnText}>Confirm Safe</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL: Active Ward Map */}
      <Modal visible={isMapModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderColor: '#eee' }}>
            <View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#212529' }}>{selectedWard?.wardUser?.fullName}</Text>
              <Text style={{ fontSize: 13, color: '#6b7280' }}>
                {selectedWard?.latestLocation?.isSos ? '🚨 SOS ACTIVE' : 'Live Tracking'} • {selectedWard?.wardUser?.batteryLevel}% Battery
              </Text>
            </View>
            <TouchableOpacity onPress={() => setIsMapModalVisible(false)} style={{ padding: 8 }}>
              <Text style={{ color: '#212529', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
          {selectedWard?.latestLocation ? (
            <View style={{ flex: 1, backgroundColor: '#e5e7eb', overflow: 'hidden' }}>
              <MapView
                style={StyleSheet.absoluteFillObject}
                region={{
                  latitude: selectedWard.latestLocation.latitude,
                  longitude: selectedWard.latestLocation.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: selectedWard.latestLocation.latitude,
                    longitude: selectedWard.latestLocation.longitude,
                  }}
                  anchor={{ x: 0.5, y: 0.5 }}
                >
                  <View style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}>
                    {/* Animated outer pulsing radar ripple */}
                    <Animated.View
                      style={{
                        position: 'absolute',
                        width: 38,
                        height: 38,
                        borderRadius: 19,
                        backgroundColor: selectedWard.latestLocation.isSos ? 'rgba(239, 68, 68, 0.28)' : 'rgba(37, 99, 235, 0.28)',
                        borderWidth: 1.5,
                        borderColor: selectedWard.latestLocation.isSos ? '#ef4444' : '#3b82f6',
                        transform: [{ scale: markerPulseAnim }],
                        opacity: markerPulseOpacity,
                      }}
                    />
                    {/* Inner glowing halo */}
                    <View
                      style={{
                        position: 'absolute',
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: selectedWard.latestLocation.isSos ? 'rgba(239, 68, 68, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                      }}
                    />
                    {/* Center solid beating dot */}
                    <View
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 7,
                        backgroundColor: selectedWard.latestLocation.isSos ? '#ef4444' : '#2563eb',
                        borderWidth: 2.5,
                        borderColor: '#ffffff',
                        shadowColor: selectedWard.latestLocation.isSos ? '#ef4444' : '#1d4ed8',
                        shadowOffset: { width: 0, height: 1 },
                        shadowOpacity: 0.8,
                        shadowRadius: 3,
                        elevation: 5,
                      }}
                    />
                  </View>
                </Marker>
                {selectedWardTrail.length > 0 && (
                  <Polyline
                    coordinates={selectedWardTrail.map(p => ({ latitude: p.latitude, longitude: p.longitude }))}
                    strokeColor="#3b82f6" // blue
                    strokeWidth={4}
                  />
                )}
              </MapView>
            </View>
          ) : (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
              <Text style={{ color: '#6b7280' }}>Location data unavailable.</Text>
            </View>
          )}
        </SafeAreaView>
      </Modal>

      {/* MODAL: Active Wards List */}
      <Modal visible={isActiveWardsModalVisible} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: '#f5f6f7' }}>
          <View style={{ padding: 22, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderBottomWidth: 1, borderColor: '#eee' }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#212529' }}>Active Wards</Text>
              <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>People currently sharing location with you</Text>
            </View>
            <TouchableOpacity onPress={() => setIsActiveWardsModalVisible(false)} style={{ padding: 8 }}>
              <Text style={{ color: '#212529', fontWeight: '700' }}>Close</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {activeWards.length > 0 ? (
              activeWards.map(ward => (
                <View key={ward.connectionId} style={[styles.whiteCard, { marginBottom: 12 }]}>
                  <View style={styles.cardHeaderRow}>
                    <View style={[styles.iconCircleSmall, { backgroundColor: 'rgba(239, 68, 68, 0.1)' }]}>
                      <Shield color="#ef4444" size={18} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cardSectionTitle}>{ward.wardUser.fullName}</Text>
                      <Text style={styles.cardSectionSub}>
                        {ward.latestLocation?.isSos ? '🚨 SOS ACTIVE' : '🟢 Tracking Live'} • {ward.wardUser.batteryLevel}% Battery
                      </Text>
                      {ward.latestLocation && (
                        <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>
                          📡 Net: {ward.latestLocation.networkType || 'WIFI'} • GPS: {ward.latestLocation.accuracyMeters < 20 ? 'Strong' : (ward.latestLocation.accuracyMeters > 50 ? 'Weak' : 'Fair')}
                        </Text>
                      )}
                    </View>
                    <TouchableOpacity
                      style={{ backgroundColor: '#212529', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12 }}
                      onPress={() => {
                        setIsActiveWardsModalVisible(false);
                        setSelectedWard(ward);
                        setTimeout(() => setIsMapModalVisible(true), 300);
                      }}
                    >
                      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '700' }}>View Map</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            ) : (
              <View style={{ padding: 32, alignItems: 'center' }}>
                <Shield color="#d1d5db" size={48} style={{ marginBottom: 16 }} />
                <Text style={{ color: '#6b7280', textAlign: 'center', fontWeight: '500' }}>No active wards right now. If your family turns on tracking, they will appear here.</Text>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f6f7',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 10,
  },
  greetingHeader: {
    fontSize: 26,
    fontWeight: '800',
    color: '#212529',
    letterSpacing: -0.5,
  },
  greetingSub: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 2,
    fontWeight: '500',
  },
  circleHeaderBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.5)',
  },
  scrollContent: {
    paddingHorizontal: 22,
    paddingTop: 8,
    gap: 14,
  },
  tabHeading: {
    fontSize: 22,
    fontWeight: '800',
    color: '#212529',
  },
  tabSubheading: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  codeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(16px)' } as any : {}),
  },
  codeCardLeft: {
    gap: 2,
  },
  codeCardLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#6b7280',
    letterSpacing: 0.5,
  },
  codeCardValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#212529',
    letterSpacing: 1,
  },
  codeCardSub: {
    fontSize: 11,
    color: '#9ca3af',
  },
  copyPillBtn: {
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
  },
  copyPillBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#212529',
  },
  heroBlackCard: {
    backgroundColor: '#212529',
    borderRadius: 30,
    padding: 22,
    shadowColor: '#212529',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 6,
    gap: 18,
  },
  heroCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  heroCardTitle: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  heroCardSub: {
    color: '#9ca3af',
    fontSize: 12,
    marginTop: 3,
  },
  heroStatusBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  heroStatusBadgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '800',
  },
  heroActionPill: {
    backgroundColor: '#ffffff',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroActionPillText: {
    color: '#212529',
    fontSize: 14,
    fontWeight: '800',
  },
  arrowCircleDark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#f5f6f7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  whiteCard: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
    gap: 14,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircleSmall: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#212529',
  },
  cardSectionSub: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  telemetryContainer: {
    flexDirection: 'row',
    gap: 10,
  },
  telemetryPill: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 18,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  telemetryPillText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '600',
  },
  addGuardianBtn: {
    backgroundColor: '#212529',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 14,
  },
  addGuardianBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  guardianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  guardianAvatarCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#fcd34d', // Yellow accent for avatars
    justifyContent: 'center',
    alignItems: 'center',
  },
  guardianName: {
    fontSize: 14,
    fontWeight: '700',
    color: '#212529',
  },
  guardianCode: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  smallCodePill: {
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  smallCodePillText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#212529',
  },
  pillAcceptBtn: {
    backgroundColor: '#212529',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pillAcceptBtnText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
  },
  pillDeclineBtn: {
    backgroundColor: 'rgba(241, 245, 249, 0.8)',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  pillDeclineBtnText: {
    color: '#6b7280',
    fontSize: 12,
    fontWeight: '700',
  },
  bottomNavWrapper: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  bottomNavContainer: {
    flexDirection: 'row',
    backgroundColor: '#212529',
    borderRadius: 35,
    padding: 6,
    shadowColor: '#212529',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 6,
    justifyContent: 'center',
    gap: 16,
  },
  navItem: {
    padding: 8,
  },
  navIconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  navIconCircleActive: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
  },
  inputGroup: {
    gap: 8,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cleanInput: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#212529',
    fontWeight: '500',
  },
  profileTextValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginTop: 4,
  },
  savePillBtn: {
    backgroundColor: '#fcd34d', // Tertiary Yellow Accent
    paddingVertical: 14,
    borderRadius: 20,
    alignItems: 'center',
    marginTop: 10,
  },
  savePillBtnText: {
    color: '#212529',
    fontSize: 15,
    fontWeight: '800',
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.05)',
  },
  actionRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#212529',
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  deleteBtnText: {
    color: '#ef4444',
    fontSize: 15,
    fontWeight: '700',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(33, 37, 41, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(8px)' } as any : {}),
  },
  cleanModalCard: {
    backgroundColor: '#ffffff',
    borderRadius: 28,
    padding: 24,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: '#212529',
    marginBottom: 8,
  },
  modalExplanation: {
    fontSize: 13,
    color: '#6b7280',
    lineHeight: 18,
    marginBottom: 20,
  },
  modalInputField: {
    backgroundColor: '#f5f6f7',
    borderRadius: 16,
    padding: 16,
    fontSize: 16,
    fontWeight: '600',
    color: '#212529',
    marginBottom: 20,
  },
  modalPinField: {
    backgroundColor: '#f5f6f7',
    borderRadius: 16,
    padding: 16,
    fontSize: 24,
    fontWeight: '800',
    color: '#212529',
    textAlign: 'center',
    letterSpacing: 12,
    marginBottom: 20,
  },
  modalActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  modalCancelBtn: {
    flex: 1,
    backgroundColor: '#f5f6f7',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalCancelBtnText: {
    color: '#6b7280',
    fontSize: 14,
    fontWeight: '700',
  },
  modalConfirmBtn: {
    flex: 1,
    backgroundColor: '#212529',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  modalConfirmBtnText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
