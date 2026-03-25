from typing import TypedDict, Literal, Annotated, Sequence
from langgraph.graph import StateGraph, END
from langchain_core.messages import BaseMessage, HumanMessage, AIMessage
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
import os
from dotenv import load_dotenv

load_dotenv()

# Define the Agent State
class AgentState(TypedDict):
    messages: Sequence[BaseMessage]
    next_step: Literal["generalist", "coder", "finish"]

# --- Node Definitions ---

def generalist_node(state: AgentState):
    """
    The Generalist decides if the query needs code or simple chat.
    """
    messages = state['messages']
    last_message = messages[-1]
    
    # Simple routing logic (in prod, use an LLM router)
    content = last_message.content.lower()
    
    if "code" in content or "python" in content or "script" in content or "function" in content:
        return {"next_step": "coder", "messages": [AIMessage(content="Routing to Code Specialist...")]}
    
    # Process as general chat
    # In a real app, we'd use OpenAI here. mocking for speed/demo if no key.
    if os.getenv("OPENAI_API_KEY"):
        llm = ChatOpenAI(model="gpt-4o")
        response = llm.invoke(messages)
        return {"next_step": "finish", "messages": [response]}
    
    return {"next_step": "finish", "messages": [AIMessage(content=f"Processed by Generalist: {last_message.content}")]}

def coder_node(state: AgentState):
    """
    The Specialist for writing code.
    """
    messages = state['messages']
    # Find the original human request
    human_msg = next((m for m in messages if isinstance(m, HumanMessage)), None)
    query = human_msg.content if human_msg else "No query found"

    # Mocking code generation or using Anthropic if available
    response_content = f"```python\n# Solution for: {query}\ndef solve():\n    print('Solved!')\n```"
    
    if os.getenv("ANTHROPIC_API_KEY"):
        llm = ChatAnthropic(model="claude-3-5-sonnet-20240620")
        response = llm.invoke(messages)
        response_content = response.content

    return {"next_step": "finish", "messages": [AIMessage(content=response_content)]}

# --- Graph Construction ---

workflow = StateGraph(AgentState)

workflow.add_node("generalist", generalist_node)
workflow.add_node("coder", coder_node)

workflow.set_entry_point("generalist")

def router(state: AgentState):
    if state["next_step"] == "coder":
        return "coder"
    return END

workflow.add_conditional_edges("generalist", router)
workflow.add_edge("coder", END)

app = workflow.compile()
