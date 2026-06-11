const fs = require("fs");
const p = "G:/2026Work/AIchat/ai-chat-clone/src/app/chat/[id].tsx";
let c = fs.readFileSync(p, "utf8");

const handlerCode = `
  // === 对话纠正 ===
  const handleCorrection = useCallback(async (msg: UIMessage) => {
    Alert.alert("纠正TA", "她应该怎么回应？输入你期望的表达方式。", [
      { text: "取消", style: "cancel" },
      { text: "确认纠正", onPress: () => setCorrectingMsg(msg) },
    ]);
  }, []);

  const [correctingMsg, setCorrectingMsg] = useState<UIMessage | null>(null);
  const [correctionInput, setCorrectionInput] = useState("");
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  const submitCorrection = useCallback(async () => {
    if (!correctingMsg || !correctionInput.trim()) return;
    setSubmittingCorrection(true);
    try {
      const parsed = await parseCorrection(persona?.name || "她", correctionInput);
      if (persona?.id) {
        await addCorrection(persona.id, {
          scene: parsed.scene || "对话中",
          wrongBehavior: parsed.wrongBehavior || "当前回复",
          correctBehavior: parsed.correctBehavior || correctionInput,
          timestamp: new Date().toISOString(),
        });
      }
      Alert.alert("✅ 已记录", parsed.correctionRecord || correctionInput);
    } catch {
      if (persona?.id) {
        await addCorrection(persona.id, {
          scene: "对话中",
          wrongBehavior: "当前回复",
          correctBehavior: correctionInput,
          timestamp: new Date().toISOString(),
        });
      }
      Alert.alert("✅ 已记录", "已记录纠正：" + correctionInput);
    }
    setCorrectingMsg(null);
    setCorrectionInput("");
    setSubmittingCorrection(false);
  }, [correctingMsg, correctionInput, persona]);
`;

const m2 = "const renderMessage";
const i2 = c.indexOf(m2);
if (i2 < 0) { console.log("Marker not found"); process.exit(1); }
c = c.substring(0, i2) + handlerCode + "\n" + c.substring(i2);
fs.writeFileSync(p, c, "utf8");
console.log("Injected clean handler code");
