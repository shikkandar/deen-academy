import { router } from "expo-router";
import { StyleSheet } from "react-native";

import { Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useT } from "@/hooks/use-t";

import { SpringPressable } from "./motion";
import { SearchIcon } from "./search-icon";
import { ThemedText } from "./themed-text";

/** "Search in <book>": opens the search for this one book only (scope as in lib/hadith-search parseScope). */
export function BookSearchButton({
  scope,
  title,
}: {
  scope: string;
  title: string;
}) {
  const theme = useTheme();
  const t = useT();
  return (
    <SpringPressable
      pressedScale={0.98}
      onPress={() =>
        router.push({ pathname: "/hadith/search", params: { scope, title } })
      }
      style={[
        styles.pill,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
      ]}
    >
      <SearchIcon size={18} color={theme.textSecondary} />
      <ThemedText
        themeColor="textSecondary"
        numberOfLines={1}
        style={styles.text}
      >
        {t("Search in {title}", { title: t(title) })}
      </ThemedText>
    </SpringPressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.two + 2,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: Spacing.three,
    height: 46,
  },
  text: { flex: 1, fontSize: 16 },
});
