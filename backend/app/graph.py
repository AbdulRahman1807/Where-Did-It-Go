"""The investigation graph.

    intake --> investigate <==> tools      (bounded tool-calling loop,
                                             one call per "tools" step --
                                             see app/nodes/tools.py)
             investigate --> synthesize --> assess
                                              |
                                (review required?)
                                    /              \\
                                  yes                no
                                   |                  |
                             human_review          finalize --> END
                          (interrupt/resume)
                             /     |      \\
                    investigate  finalize  escalate --> END
                    (reject /   (approve /
                     investigate  modify)
                     _more, if
                     round budget
                     remains)

Every element Master Spec section 15 asks for is here: state (app/state.py),
conditional routing (route_after_investigate, the assess->review branch,
route_after_human_review), tool use (the investigate/tools loop), review
interruption and resumption (human_review_node's interrupt() call), and
controlled looping with termination (max_rounds, enforced in human_review).
"""

from __future__ import annotations

from langgraph.graph import END, StateGraph

from app.nodes.assess import assess_node
from app.nodes.finalize import escalate_node, finalize_node
from app.nodes.human_review import human_review_node, route_after_human_review
from app.nodes.intake import intake_node
from app.nodes.investigate import investigate_node, route_after_investigate
from app.nodes.synthesize import synthesize_node
from app.nodes.tools import execute_one_tool, route_after_tool
from app.state import InvestigationState


def route_after_assess(state: InvestigationState) -> str:
    return "human_review" if state["review"]["required"] else "finalize"


def build_graph(checkpointer) -> StateGraph:
    graph = StateGraph(InvestigationState)

    graph.add_node("intake", intake_node)
    graph.add_node("investigate", investigate_node)
    graph.add_node("tools", execute_one_tool)
    graph.add_node("synthesize", synthesize_node)
    graph.add_node("assess", assess_node)
    graph.add_node("human_review", human_review_node)
    graph.add_node("finalize", finalize_node)
    graph.add_node("escalate", escalate_node)

    graph.set_entry_point("intake")
    graph.add_edge("intake", "investigate")
    graph.add_conditional_edges(
        "investigate", route_after_investigate, {"tools": "tools", "synthesize": "synthesize"}
    )
    graph.add_conditional_edges(
        "tools", route_after_tool, {"tools": "tools", "investigate": "investigate"}
    )
    graph.add_edge("synthesize", "assess")
    graph.add_conditional_edges(
        "assess", route_after_assess, {"human_review": "human_review", "finalize": "finalize"}
    )
    graph.add_conditional_edges(
        "human_review",
        route_after_human_review,
        {"investigate": "investigate", "finalize": "finalize", "escalate": "escalate"},
    )
    graph.add_edge("finalize", END)
    graph.add_edge("escalate", END)

    return graph.compile(checkpointer=checkpointer)
