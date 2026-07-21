import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Clock, ListDashes, User } from 'phosphor-react-native';
import { useAuth } from '../context/AuthContext';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { TimesheetScreen } from '../screens/TimesheetScreen';
import { JustificationScreen } from '../screens/JustificationScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { colors, fontFamily } from '../theme';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontFamily: fontFamily.semiBold, fontSize: 10 },
        tabBarStyle: { borderTopColor: colors.border, height: 64, paddingBottom: 8, paddingTop: 6 },
      }}
    >
      <Tab.Screen
        name="BaterPonto"
        component={HomeScreen}
        options={{
          title: 'Bater Ponto',
          tabBarIcon: ({ color, size }) => <Clock size={size} color={color} weight="bold" />,
        }}
      />
      <Tab.Screen
        name="Historico"
        component={HistoryScreen}
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color, size }) => <ListDashes size={size} color={color} weight="bold" />,
        }}
      />
      <Tab.Screen
        name="Perfil"
        component={ProfileScreen}
        options={{
          title: 'Perfil',
          tabBarIcon: ({ color, size }) => <User size={size} color={color} weight="bold" />,
        }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="Timesheet" component={TimesheetScreen} />
            <Stack.Screen name="Justification" component={JustificationScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
