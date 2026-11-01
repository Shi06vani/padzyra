import 'react-native';

declare module 'react-native' {
  interface FlexStyle {
    gap?: number | string | undefined;
    rowGap?: number | string | undefined;
    columnGap?: number | string | undefined;
  }
  interface ViewStyle {
    gap?: number | string | undefined;
    rowGap?: number | string | undefined;
    columnGap?: number | string | undefined;
  }
}
