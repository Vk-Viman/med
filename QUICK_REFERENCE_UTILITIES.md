# 🚀 Quick Reference: Using New Utilities

## 📚 Import Statements

```javascript
// Constants & Utilities
import { 
  getMoodEmoji, 
  formatDateTime, 
  formatDate, 
  formatTime, 
  getRelativeTime,
  TIME, 
  LIMITS, 
  STORAGE_KEYS,
  ERROR_MESSAGES 
} from '../src/utils/constants';

// Error Handling
import { 
  handleError, 
  withErrorHandler, 
  createErrorHandler,
  ERROR_SEVERITY 
} from '../src/utils/errorHandler';

// Network
import { 
  fetchWithTimeout, 
  fetchWithRetry, 
  fetchJSON, 
  postJSON, 
  putJSON,
  deleteJSON,
  isOnline 
} from '../src/utils/network';

// Components
import ErrorBoundary from '../src/components/ErrorBoundary';
import OfflineIndicator from '../src/components/OfflineIndicator';
```

## 🎯 Common Patterns

### 1. Error Handling

```javascript
// Pattern 1: Direct error handling
try {
  await somethingRisky();
} catch (error) {
  handleError(error, 'ComponentName:actionName', {
    showAlert: true,
    severity: ERROR_SEVERITY.HIGH
  });
}

// Pattern 2: Async wrapper
const result = await withErrorHandler(
  () => fetchUserData(),
  'Profile:loadData'
);

// Pattern 3: Component-specific handler
const errorHandler = createErrorHandler('MoodTracker');
try {
  await saveMood(data);
} catch (error) {
  errorHandler(error, 'saveMood');
}

// Pattern 4: Silent background errors
try {
  await backgroundSync();
} catch (error) {
  handleError(error, 'BackgroundSync', { 
    showAlert: false, 
    severity: ERROR_SEVERITY.LOW 
  });
}
```

### 2. Network Requests

```javascript
// Simple fetch with timeout
const response = await fetchWithTimeout(url, options, 30000);

// Fetch with retry
const response = await fetchWithRetry(url, options);

// JSON request with all features
const { success, data, error } = await fetchJSON(
  'https://api.example.com/data',
  {
    method: 'POST',
    body: JSON.stringify({ foo: 'bar' })
  },
  {
    retry: true,
    timeout: 30000,
    showError: true,
    context: 'LoadUserProfile'
  }
);

if (success) {
  console.log('Data:', data);
} else {
  console.error('Error:', error);
}

// POST helper
const { success, data } = await postJSON('/api/mood', moodData, {
  context: 'SaveMood'
});

// Check connectivity
if (await isOnline()) {
  // Make request
} else {
  Alert.alert('Offline', 'Check your connection');
}
```

### 3. Constants Usage

```javascript
// Mood utilities
const emoji = getMoodEmoji(7); // 🙂
const formattedDate = formatDateTime(new Date()); // "2025-10-12 14:30"
const relativeTime = getRelativeTime(createdAt); // "2h ago"

// Timeouts
setTimeout(doSomething, TIME.ANIMATION_NORMAL_MS);
const cache = await getCached({ ttl: TIME.CHART_CACHE_TTL_MS });

// Limits
const maxChars = LIMITS.MAX_NOTE_LENGTH; // 500
if (text.length > maxChars) {
  Alert.alert('Too long', `Max ${maxChars} characters`);
}

// Storage keys
await AsyncStorage.setItem(STORAGE_KEYS.THEME, 'dark');

// Error messages
throw new Error(ERROR_MESSAGES.NETWORK_ERROR);
```

### 4. Performance Optimization

```javascript
import React, { useMemo, useCallback, memo } from 'react';

// Memoize expensive calculations
const chartData = useMemo(() => {
  return processLargeDataset(entries);
}, [entries]);

// Memoize callbacks passed as props
const handlePress = useCallback(() => {
  navigate('/details');
}, [navigate]);

// Memoize component
const ListItem = memo(({ item }) => {
  return <View>...</View>;
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id;
});

// FlatList optimizations
<FlatList
  data={items}
  renderItem={renderItem}
  keyExtractor={item => item.id}
  windowSize={10}
  maxToRenderPerBatch={8}
  updateCellsBatchingPeriod={50}
  removeClippedSubviews={true}
  initialNumToRender={8}
/>
```

### 5. Pull-to-Refresh

```javascript
import { RefreshControl } from 'react-native';

const [refreshing, setRefreshing] = useState(false);

const onRefresh = useCallback(async () => {
  setRefreshing(true);
  try {
    await reloadData();
  } catch (error) {
    handleError(error, 'Screen:refresh', { showAlert: false });
  } finally {
    setRefreshing(false);
  }
}, []);

<FlatList
  refreshControl={
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor={theme.primary}
      colors={[theme.primary]}
    />
  }
  ...
/>
```

### 6. Error Boundary

```javascript
// Wrap app or specific screens
<ErrorBoundary>
  <YourApp />
</ErrorBoundary>

// Custom fallback
<ErrorBoundary
  fallback={({ error, resetError }) => (
    <View>
      <Text>Something went wrong</Text>
      <Button title="Reset" onPress={resetError} />
    </View>
  )}
  onReset={() => {
    // Clean up state
    navigation.navigate('Home');
  }}
>
  <RiskyComponent />
</ErrorBoundary>
```

### 7. Offline Indicator

```javascript
// Just add to root layout (already done!)
<OfflineIndicator />

// Automatically shows/hides based on network state
// Shows count of queued mood entries
```

## 🎨 Accessibility Best Practices

```javascript
// Touch targets (minimum 44pt)
<Pressable
  style={{
    minHeight: 44,
    minWidth: 44,
    justifyContent: 'center',
    alignItems: 'center',
  }}
  accessibilityRole="button"
  accessibilityLabel="Save mood entry"
  accessibilityHint="Saves your current mood to history"
  accessibilityState={{ disabled: loading }}
>
  <Text>Save</Text>
</Pressable>

// Screen announcements
useEffect(() => {
  const timeout = setTimeout(() => {
    AccessibilityInfo.announceForAccessibility(
      'Mood Tracker. Record your current mood and stress level.'
    );
  }, 300);
  return () => clearTimeout(timeout);
}, []);
```

## ⚡ Performance Tips

1. **Always memoize callbacks passed to child components**
   ```javascript
   const handlePress = useCallback(() => {}, [deps]);
   ```

2. **Memoize expensive calculations**
   ```javascript
   const result = useMemo(() => calculate(data), [data]);
   ```

3. **Use React.memo for list items**
   ```javascript
   const ListItem = memo(Component, compareFunc);
   ```

4. **Optimize FlatList**
   - Set `windowSize` to 10-15
   - Set `maxToRenderPerBatch` to 8-10
   - Enable `removeClippedSubviews`
   - Add `getItemLayout` if items have fixed height

5. **Debounce text input**
   ```javascript
   const debouncedSearch = useMemo(
     () => debounce(search, TIME.SEARCH_DEBOUNCE_MS),
     []
   );
   ```

## 🐛 Debugging

```javascript
// Enable debug logs
import { FEATURES } from '../src/utils/constants';

if (FEATURES.ENABLE_DEBUG_LOGS) {
  console.log('Debug info:', data);
}

// Development-only code
if (__DEV__) {
  console.log('Dev only:', error);
}

// Error handler logs to console in dev automatically
```

## 📦 Optional Dependencies

```bash
# For full offline support
npm install @react-native-community/netinfo

# For crash reporting (choose one)
npm install @sentry/react-native
# or
npm install @react-native-firebase/crashlytics

# For performance monitoring
npm install @react-native-firebase/perf
```

## 🔍 Common Mistakes to Avoid

❌ **Don't:**
```javascript
// Empty catch blocks
try { await api() } catch {}

// Magic numbers
setTimeout(fn, 5000);
if (text.length > 500) {}

// No error handling
const data = await fetch(url);

// Inline callbacks
<Button onPress={() => navigate('/')} />

// No memoization
{items.map(item => <Item key={item.id} />)}
```

✅ **Do:**
```javascript
// Proper error handling
try { 
  await api() 
} catch (error) {
  handleError(error, 'Context', { showAlert: true });
}

// Use constants
setTimeout(fn, TIME.ANIMATION_NORMAL_MS);
if (text.length > LIMITS.MAX_NOTE_LENGTH) {}

// Network utilities
const { success, data } = await fetchJSON(url);

// Memoized callbacks
const handlePress = useCallback(() => navigate('/'), []);
<Button onPress={handlePress} />

// Memoized components
const Item = memo(({ item }) => <View>...</View>);
{items.map(item => <Item key={item.id} item={item} />)}
```

---

**Last Updated:** October 12, 2025  
**Version:** 1.0  
**Status:** Production Ready ✅
