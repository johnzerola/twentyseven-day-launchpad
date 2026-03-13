import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flame, Trophy, Target, Calendar, FileText, Sparkles, TrendingUp, CheckCircle2, Clock, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';

interface DayActivity {
  date: string;
  scripts: number;
  titles: number;
  projects: number;
  total: number;
}

interface WeeklyGoals {
  scripts: { current: number; target: number };
  titles: { current: number; target: number };
  projects: { current: number; target: number };
}

export const ProductivityDashboard = () => {
  const [todayStats, setTodayStats] = useState({ scripts: 0, titles: 0, projects: 0, searches: 0, total: 0 });
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoals>({
    scripts: { current: 0, target: 3 },
    titles: { current: 0, target: 5 },
    projects: { current: 0, target: 2 },
  });
  const [weekDays, setWeekDays] = useState<DayActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const uid = session.user.id;

      const today = new Date();
      const todayStr = today.toISOString().slice(0, 10);
      
      // Get start of current week (Monday)
      const weekStart = new Date(today);
      const dayOfWeek = today.getDay();
      const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      weekStart.setDate(today.getDate() - diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString();

      // Go back 60 days for streak calculation
      const sixtyDaysAgo = new Date(today);
      sixtyDaysAgo.setDate(today.getDate() - 60);
      const sixtyDaysAgoStr = sixtyDaysAgo.toISOString();

      // Fetch all activity data in parallel
      const [scripts60d, titles60d, projects60d, searches60d] = await Promise.all([
        supabase.from('saved_scripts').select('created_at').eq('user_id', uid).gte('created_at', sixtyDaysAgoStr),
        supabase.from('saved_titles').select('created_at').eq('user_id', uid).gte('created_at', sixtyDaysAgoStr),
        supabase.from('video_projects').select('created_at').eq('user_id', uid).gte('created_at', sixtyDaysAgoStr),
        supabase.from('saved_searches').select('created_at').eq('user_id', uid).gte('created_at', sixtyDaysAgoStr),
      ]);

      // Build daily activity map
      const dailyMap: Record<string, { scripts: number; titles: number; projects: number; searches: number }> = {};
      
      const addToDay = (items: any[] | null, key: keyof typeof dailyMap[string]) => {
        (items || []).forEach(item => {
          const day = item.created_at.slice(0, 10);
          if (!dailyMap[day]) dailyMap[day] = { scripts: 0, titles: 0, projects: 0, searches: 0 };
          dailyMap[day][key]++;
        });
      };

      addToDay(scripts60d.data, 'scripts');
      addToDay(titles60d.data, 'titles');
      addToDay(projects60d.data, 'projects');
      addToDay(searches60d.data, 'searches');

      // Today stats
      const todayData = dailyMap[todayStr] || { scripts: 0, titles: 0, projects: 0, searches: 0 };
      setTodayStats({
        ...todayData,
        total: todayData.scripts + todayData.titles + todayData.projects + todayData.searches,
      });

      // Calculate streak (consecutive days with any activity, counting backwards from today)
      let currentStreak = 0;
      let maxStreak = 0;
      let tempStreak = 0;
      
      for (let i = 0; i <= 60; i++) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const dayData = dailyMap[dayStr];
        const hasActivity = dayData && (dayData.scripts + dayData.titles + dayData.projects + dayData.searches > 0);
        
        if (i === 0 && !hasActivity) {
          // Today has no activity yet - check if yesterday had activity for streak
          continue;
        }
        
        if (hasActivity) {
          if (i <= 1 || currentStreak > 0) {
            currentStreak++;
          }
          tempStreak++;
        } else {
          if (currentStreak === 0 && i <= 1) continue; // Skip today if no activity
          maxStreak = Math.max(maxStreak, tempStreak);
          tempStreak = 0;
          if (currentStreak > 0) break; // Stop counting current streak
        }
      }
      maxStreak = Math.max(maxStreak, tempStreak);
      
      setStreak(currentStreak);
      setBestStreak(maxStreak);

      // Weekly goals - count items created this week
      const weekScripts = (scripts60d.data || []).filter(s => s.created_at >= weekStartStr).length;
      const weekTitles = (titles60d.data || []).filter(t => t.created_at >= weekStartStr).length;
      const weekProjects = (projects60d.data || []).filter(p => p.created_at >= weekStartStr).length;
      
      setWeeklyGoals({
        scripts: { current: weekScripts, target: 3 },
        titles: { current: weekTitles, target: 5 },
        projects: { current: weekProjects, target: 2 },
      });

      // Build 7-day activity for mini heatmap
      const days: DayActivity[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dayStr = d.toISOString().slice(0, 10);
        const dayData = dailyMap[dayStr] || { scripts: 0, titles: 0, projects: 0 };
        days.push({
          date: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', ''),
          scripts: dayData.scripts,
          titles: dayData.titles,
          projects: dayData.projects,
          total: dayData.scripts + dayData.titles + dayData.projects,
        });
      }
      setWeekDays(days);
      setLoading(false);
    };
    load();
  }, []);

  if (loading) return null;

  const getStreakEmoji = () => {
    if (streak >= 30) return '👑';
    if (streak >= 14) return '🔥🔥';
    if (streak >= 7) return '🔥';
    if (streak >= 3) return '💪';
    if (streak >= 1) return '✨';
    return '😴';
  };

  const getStreakMessage = () => {
    if (streak >= 30) return 'Lendário! 30+ dias seguidos!';
    if (streak >= 14) return 'Imparável! Continue assim!';
    if (streak >= 7) return 'Uma semana completa! 🎯';
    if (streak >= 3) return 'Boa sequência!';
    if (streak >= 1) return 'Mandando bem!';
    return 'Comece hoje e inicie sua sequência!';
  };

  const totalWeeklyPercent = Math.min(100, Math.round(
    ((weeklyGoals.scripts.current / weeklyGoals.scripts.target) +
     (weeklyGoals.titles.current / weeklyGoals.titles.target) +
     (weeklyGoals.projects.current / weeklyGoals.projects.target)) / 3 * 100
  ));

  const getHeatColor = (total: number) => {
    if (total === 0) return 'bg-muted/30';
    if (total === 1) return 'bg-chart-2/20';
    if (total === 2) return 'bg-chart-2/40';
    if (total <= 4) return 'bg-chart-2/60';
    return 'bg-chart-2/80';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.08 }}
      className="glass rounded-xl p-5 border border-primary/10"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold flex items-center gap-2 text-sm">
          <Zap className="w-4 h-4 text-primary" /> Produtividade Diária
        </h3>
        <Badge variant="outline" className="text-[10px] gap-1 font-mono">
          <Calendar className="w-3 h-3" />
          {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* ═══ Today's Production ═══ */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Hoje</p>
          
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl font-black ${
              todayStats.total > 0 ? 'bg-primary/15 text-primary' : 'bg-muted/30 text-muted-foreground'
            }`}>
              {todayStats.total}
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {todayStats.total === 0 ? 'Nada produzido' : `${todayStats.total} ${todayStats.total === 1 ? 'item' : 'itens'}`}
              </p>
              <p className="text-[10px] text-muted-foreground">
                {todayStats.total === 0 ? 'Comece agora!' : 'Continue assim!'}
              </p>
            </div>
          </div>

          {/* Today breakdown */}
          <div className="space-y-1.5">
            {todayStats.scripts > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <FileText className="w-3 h-3 text-chart-4" />
                <span>{todayStats.scripts} roteiro{todayStats.scripts > 1 ? 's' : ''}</span>
              </div>
            )}
            {todayStats.titles > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <Sparkles className="w-3 h-3 text-chart-3" />
                <span>{todayStats.titles} título{todayStats.titles > 1 ? 's' : ''}</span>
              </div>
            )}
            {todayStats.projects > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <Target className="w-3 h-3 text-chart-2" />
                <span>{todayStats.projects} projeto{todayStats.projects > 1 ? 's' : ''}</span>
              </div>
            )}
            {todayStats.searches > 0 && (
              <div className="flex items-center gap-2 text-[11px]">
                <TrendingUp className="w-3 h-3 text-chart-1" />
                <span>{todayStats.searches} pesquisa{todayStats.searches > 1 ? 's' : ''}</span>
              </div>
            )}
            {todayStats.total === 0 && (
              <p className="text-[10px] text-muted-foreground/60 italic">Crie um roteiro ou título para começar o dia</p>
            )}
          </div>
        </div>

        {/* ═══ Streak ═══ */}
        <div className="space-y-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Sequência</p>
          
          <div className="flex items-center gap-3">
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-2xl ${
              streak >= 7 ? 'bg-destructive/15' : streak >= 1 ? 'bg-chart-3/15' : 'bg-muted/30'
            }`}>
              {getStreakEmoji()}
            </div>
            <div>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-black ${streak >= 7 ? 'text-destructive' : streak >= 1 ? 'text-chart-3' : 'text-muted-foreground'}`}>
                  {streak}
                </span>
                <span className="text-[10px] text-muted-foreground">dia{streak !== 1 ? 's' : ''}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{getStreakMessage()}</p>
            </div>
          </div>

          {bestStreak > streak && (
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Trophy className="w-3 h-3 text-chart-3" />
              <span>Melhor: <strong className="text-foreground">{bestStreak} dias</strong></span>
            </div>
          )}

          {/* 7-day heatmap */}
          <div className="flex gap-1">
            {weekDays.map((day, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className={`w-full aspect-square rounded-md ${getHeatColor(day.total)} transition-colors`}
                  title={`${day.date}: ${day.total} itens`}
                />
                <span className="text-[8px] text-muted-foreground">{day.date.slice(0, 3)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Weekly Goals ═══ */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Metas Semanais</p>
            <Badge variant={totalWeeklyPercent >= 100 ? 'default' : 'outline'} className="text-[9px] gap-1">
              {totalWeeklyPercent >= 100 ? <CheckCircle2 className="w-2.5 h-2.5" /> : <Target className="w-2.5 h-2.5" />}
              {totalWeeklyPercent}%
            </Badge>
          </div>

          <div className="space-y-2.5">
            {/* Scripts goal */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3 h-3 text-chart-4" />
                  <span className="text-[11px] font-medium">Roteiros</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {weeklyGoals.scripts.current}/{weeklyGoals.scripts.target}
                </span>
              </div>
              <Progress
                value={Math.min(100, (weeklyGoals.scripts.current / weeklyGoals.scripts.target) * 100)}
                className="h-1.5"
              />
            </div>

            {/* Titles goal */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-chart-3" />
                  <span className="text-[11px] font-medium">Títulos</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {weeklyGoals.titles.current}/{weeklyGoals.titles.target}
                </span>
              </div>
              <Progress
                value={Math.min(100, (weeklyGoals.titles.current / weeklyGoals.titles.target) * 100)}
                className="h-1.5"
              />
            </div>

            {/* Projects goal */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Target className="w-3 h-3 text-chart-2" />
                  <span className="text-[11px] font-medium">Projetos</span>
                </div>
                <span className="text-[10px] text-muted-foreground font-mono">
                  {weeklyGoals.projects.current}/{weeklyGoals.projects.target}
                </span>
              </div>
              <Progress
                value={Math.min(100, (weeklyGoals.projects.current / weeklyGoals.projects.target) * 100)}
                className="h-1.5"
              />
            </div>
          </div>

          {totalWeeklyPercent >= 100 && (
            <div className="flex items-center gap-1.5 text-[10px] text-chart-2 font-medium">
              <CheckCircle2 className="w-3 h-3" /> Todas as metas cumpridas! 🎉
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};
