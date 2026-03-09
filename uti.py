from huggingface_hub import InferenceClient
import os

HF_TOKEN = os.environ.get("HF_TOKEN")
if not HF_TOKEN:
    raise ValueError("没有检测到 HF_TOKEN，请先配置环境变量")

hf_client = InferenceClient(api_key=HF_TOKEN)

def is_high_risk_message(message: str) -> bool:
    text = (message or "").lower()
    risk_keywords = [
        "自杀", "不想活", "活不下去", "结束生命", "轻生",
        "伤害自己", "想死", "去死", "割腕", "跳楼",
        "suicide", "kill myself", "end my life", "self-harm"
    ]
    return any(word in text for word in risk_keywords)


def build_system_prompt() -> str:
    return """
你是一个面向青少年的心理陪伴助手，名字叫 MindCare。
你的任务是提供温和、共情、简洁、支持性的对话，帮助用户表达情绪、梳理压力和获得基础建议。

要求：
1. 语气自然、温柔、真诚。
2. 先共情，再建议。
3. 建议要具体、简单、可执行。
4. 不要进行医疗诊断。
5. 回复长度控制在 80~180 字左右。
6. 如果用户出现明显自伤、自杀倾向，要优先鼓励其立即联系家人、老师、监护人或当地紧急援助服务。
""".strip()


def generate_ai_reply(message: str) -> str:
    if not message.strip():
        return "你可以再多和我说一点，我会认真听。"

    if is_high_risk_message(message):
        return (
            "听起来你现在真的很痛苦，请不要一个人扛着。"
            "请尽快联系你信任的家人、老师、朋友，或当地紧急援助服务。"
            "如果你现在就有伤害自己的打算，请立刻去找身边的大人陪你。"
        )

    response = hf_client.chat.completions.create(
        model="Qwen/Qwen2.5-7B-Instruct",
        messages=[
            {"role": "system", "content": build_system_prompt()},
            {"role": "user", "content": message}
        ],
        max_tokens=220
    )

    return response.choices[0].message.content.strip()