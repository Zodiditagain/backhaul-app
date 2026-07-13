{pendingMatches.map((m) => (
  <div
    key={m.id}
    className="w-full bg-white border border-amberx/40 rounded-sm px-4 py-3 flex items-center justify-between"
  >
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rotate-45 bg-asphalt/5 border border-asphalt/10 flex items-center justify-center shrink-0">
        {m.partner_role === "vendor" ? (
          <Fuel size={14} className="-rotate-45 text-steelgray" />
        ) : (
          <Handshake size={14} className="-rotate-45 text-steelgray" />
        )}
      </div>
      <div>
        <div className="text-sm font-medium">{m.partner?.company_name}</div>
        <div className="text-xs text-gray-400 font-mono uppercase tracking-wide">{m.partner_role} • wants to connect</div>
      </div>
    </div>
    <div className="flex items-center gap-3 shrink-0">
      <Link href={`/company/${m.partner_id}`} className="text-xs text-steelgray hover:text-amberx underline whitespace-nowrap">
        View Profile
      </Link>
      <button
        onClick={() => respondToMatch(m.id, "declined")}
        className="w-8 h-8 rounded-full border-2 border-gray-300 flex items-center justify-center text-steelgray hover:border-alertred hover:text-alertred transition-colors"
      >
        <X size={16} />
      </button>
      <button
        onClick={() => respondToMatch(m.id, "accepted")}
        className="w-8 h-8 rounded-full bg-highway flex items-center justify-center text-white hover:bg-green-800 transition-colors"
      >
        <Check size={16} />
      </button>
    </div>
  </div>
))}
