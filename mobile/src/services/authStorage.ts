// In-memory + safe storage for full user profile & session tokens

export interface StoredUser {
  id: string;
  userCode: string;
  email: string;
  phoneNumber: string;
  fullName: string;
  age: number;
  address: string;
  profileCompleted: boolean;
  kycStatus: string;
  batteryLevel?: number;
}

let inMemoryUser: StoredUser | null = null;
let inMemoryToken: string | null = null;

export const authStorage = {
  async saveAuth(token: string, user: StoredUser) {
    inMemoryToken = token;
    inMemoryUser = user;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      if (AsyncStorage) {
        await AsyncStorage.setItem('RAKSHA_AUTH_TOKEN', token);
        await AsyncStorage.setItem('RAKSHA_USER_DATA', JSON.stringify(user));
      }
    } catch (e) {}
  },

  async getUser(): Promise<StoredUser | null> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      if (AsyncStorage) {
        const data = await AsyncStorage.getItem('RAKSHA_USER_DATA');
        if (data) return JSON.parse(data);
      }
    } catch (e) {}
    return inMemoryUser;
  },

  async getToken(): Promise<string | null> {
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      if (AsyncStorage) {
        const token = await AsyncStorage.getItem('RAKSHA_AUTH_TOKEN');
        if (token) return token;
      }
    } catch (e) {}
    return inMemoryToken;
  },

  async clearAuth() {
    inMemoryToken = null;
    inMemoryUser = null;
    try {
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      if (AsyncStorage) {
        await AsyncStorage.clear();
      }
    } catch (e) {}
  }
};
