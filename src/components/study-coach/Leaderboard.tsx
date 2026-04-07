// 🔥 Only showing UPDATED parts (clean + focused)

{/* HEADER */}
<DialogHeader className="space-y-2">
  <div className="flex items-center justify-between">
    <DialogTitle className="flex items-center gap-2">
      <Trophy className="h-5 w-5 text-yellow-500" />
      Leaderboard
    </DialogTitle>

    <Button
      variant="outline"
      size="sm"
      onClick={loadLeaderboard}
      className="gap-1"
    >
      <Loader2 className={cn("h-3 w-3", loading && "animate-spin")} />
      Refresh
    </Button>
  </div>

  <p className="text-xs text-muted-foreground">
    This week ends on April 5, 23:59 UTC
  </p>
</DialogHeader>

{/* MAIN TABS (match design) */}
<Tabs value={activeTab} onValueChange={setActiveTab}>
  <TabsList className="w-full grid grid-cols-2">
    <TabsTrigger value="rankings">🏆 Rankings</TabsTrigger>
    <TabsTrigger value="progress">✨ My Progress</TabsTrigger>
  </TabsList>

  {/* RANKINGS TAB */}
  <TabsContent value="rankings" className="mt-3">

    {/* FILTER CHIPS */}
    <div className="flex gap-2 mb-3">
      {["week", "global", "friends"].map((f) => (
        <Button
          key={f}
          size="sm"
          variant="outline"
          className={cn(
            "rounded-full text-xs",
            f === "global" && "bg-primary text-white"
          )}
        >
          {f === "week" && "This Week"}
          {f === "global" && "Global"}
          {f === "friends" && "Friends"}
        </Button>
      ))}
    </div>

    <RankingsTab
      loading={loading}
      entries={entries}
      tierConfig={tierConfig}
    />
  </TabsContent>

  {/* PROGRESS TAB */}
  <TabsContent value="progress" className="mt-3">
    {userScore ? (
      <UserScoreCard score={userScore} tierConfig={tierConfig} />
    ) : (
      <div className="text-center py-6 text-sm text-muted-foreground">
        Join leaderboard to track your progress
      </div>
    )}
  </TabsContent>
</Tabs>

{/* CLEAN EMPTY STATE (UPDATED) */}
function RankingsTab({ loading, entries, tierConfig }) {
  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="text-center py-10">
        <Trophy className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">
          No rankings yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Join and study to appear here!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map((entry) => {
        const tc = tierConfig(entry.tier);

        return (
          <div
            key={entry.rank}
            className={cn(
              "flex items-center gap-3 p-3 rounded-xl border",
              entry.is_current_user
                ? "bg-primary/5 border-primary/30"
                : "border-border"
            )}
          >
            {/* Rank */}
            <div className="w-8 text-center font-bold">
              {entry.rank === 1 ? "🥇" :
               entry.rank === 2 ? "🥈" :
               entry.rank === 3 ? "🥉" :
               `#${entry.rank}`}
            </div>

            {/* Name */}
            <div className="flex-1">
              <p className="text-sm font-medium">
                {entry.display_name}
                {entry.is_current_user && " (You)"}
              </p>
              <p className="text-xs text-muted-foreground">
                {entry.study_hours}h • {entry.streak_days}🔥 • Lv.{entry.level}
              </p>
            </div>

            {/* Score */}
            <div className="text-right">
              <p className="font-bold">{entry.discipline_score}</p>
              <p className="text-[10px] text-muted-foreground">pts</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}