// ============================================================
// src/navigation/AppNavigator.js
// Cấu hình toàn bộ navigation (Stack + Bottom Tab)
// ============================================================

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { useAuth } from '../contexts/AuthContext';
import { colors } from '../services/theme';

// Screens
import AuthScreen from '../screens/AuthScreen';
import DashboardScreen from '../screens/DashboardScreen';
import ProductsScreen from '../screens/ProductsScreen';
import OrdersScreen from '../screens/OrdersScreen';
import UsersScreen from '../screens/UsersScreen';
import ReportsScreen from '../screens/ReportsScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ---- Bottom Tab cho các màn hình chính (sau khi đăng nhập) ----
const MainTabs = () => (
  <Tab.Navigator
    screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: {
        backgroundColor: '#fff',
        borderTopColor: colors.border,
        paddingBottom: 6,
        paddingTop: 6,
        height: 60,
      },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
      tabBarIcon: ({ focused, color }) => {
        const icons = {
          Dashboard: '📊',
          Products: '👕',
          Orders: '📦',
          Users: '👥',
          Reports: '📈',
        };
        return (
          <Text style={{ fontSize: focused ? 22 : 18, opacity: focused ? 1 : 0.7 }}>
            {icons[route.name]}
          </Text>
        );
      },
    })}
  >
    <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Dashboard' }} />
    <Tab.Screen name="Products" component={ProductsScreen} options={{ tabBarLabel: 'Sản phẩm' }} />
    <Tab.Screen name="Orders" component={OrdersScreen} options={{ tabBarLabel: 'Đơn hàng' }} />
    <Tab.Screen name="Users" component={UsersScreen} options={{ tabBarLabel: 'Người dùng' }} />
    <Tab.Screen name="Reports" component={ReportsScreen} options={{ tabBarLabel: 'Báo cáo' }} />
  </Tab.Navigator>
);

// ---- Root Stack: Auth hoặc Main ----
const AppNavigator = () => {
  const { currentUser, loading } = useAuth();

  if (loading) return null; // Hoặc thêm màn hình SplashScreen

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {currentUser ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

export default AppNavigator;
