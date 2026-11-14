import { useEffect, useState } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/auth-context";
import { Barber-OnTheme } from "../../contexts/theme-context";
import { supabase } from "../../lib/supabase";

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  due_date: string | null;
}

export default function TarefasScreen() {
  const { activeOrgId, user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!activeOrgId || !user) return;
    setLoading(true);
    const { data } = await supabase
      .from("tasks")
      .select("id, title, status, priority, due_date")
      .eq("organization_id", activeOrgId)
      .eq("assigned_to", user.id)
      .neq("status", "done")
      .order("due_date", { ascending: true })
      .limit(50);
    setTasks((data ?? []) as Task[]);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    load();
  }, [activeOrgId, user]);

  const priorityColor: Record<string, string> = {
    high: Barber-OnTheme.colors.error,
    medium: Barber-OnTheme.colors.warning,
    low: Barber-OnTheme.colors.success,
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Minhas Tarefas</Text>
      </View>

      {loading && tasks.length === 0 ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Barber-OnTheme.colors.blue} />
        </View>
      ) : (
        <FlatList
          data={tasks}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyText}>Nenhuma tarefa pendente.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity style={styles.card} activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardName} numberOfLines={2}>{item.title}</Text>
                <View style={[styles.priorityDot, { backgroundColor: priorityColor[item.priority] ?? Barber-OnTheme.colors.textSecondary }]} />
              </View>
              <View style={styles.cardFooter}>
                <Text style={styles.statusBadge}>{item.status}</Text>
                {item.due_date && (
                  <Text style={[styles.dueDate, new Date(item.due_date) < new Date() && styles.overdue]}>
                    {new Date(item.due_date).toLocaleDateString("pt-BR")}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Barber-OnTheme.colors.bg },
  header: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  title: { fontSize: 22, fontWeight: "700", color: Barber-OnTheme.colors.dark },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  listContent: { padding: 16, gap: 10 },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: Barber-OnTheme.radius.md,
    padding: 14,
    borderWidth: 1,
    borderColor: Barber-OnTheme.colors.border,
  },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  cardName: { fontSize: 15, fontWeight: "600", color: Barber-OnTheme.colors.dark, flex: 1, marginRight: 8 },
  priorityDot: { width: 10, height: 10, borderRadius: 5, marginTop: 4 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  statusBadge: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", color: Barber-OnTheme.colors.textSecondary },
  dueDate: { fontSize: 12, color: Barber-OnTheme.colors.textSecondary },
  overdue: { color: Barber-OnTheme.colors.error, fontWeight: "600" },
  emptyBox: { padding: 32, alignItems: "center" },
  emptyText: { fontSize: 13, color: Barber-OnTheme.colors.textSecondary },
});