import os
import re
import json
import logging
import google.generativeai as genai
from services.retriever import retrieve_context

logger = logging.getLogger("learning_recommender")

API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

def generate_learning_plan(weak_concepts: list, topic: str) -> dict:
    if not API_KEY:
        logger.warning("GEMINI_API_KEY not set. Using mock learning plan.")
        return {
            "plan": [
                {
                    "concept": concept,
                    "explanation": f"Mock explanation for {concept}",
                    "resources": [f"Study {topic} documentation about {concept}"]
                } for concept in weak_concepts
            ]
        }

    # Retrieve context for each weak concept
    combined_context = []
    for concept in weak_concepts:
        contexts = retrieve_context(query=concept, topic=topic, top_k=2)
        if contexts:
            combined_context.append(f"--- Context for {concept} ---")
            combined_context.extend(contexts)

    formatted_context = "\n".join(combined_context) if combined_context else "No specific context found."

    prompt = f"""
You are an expert technical tutor. A candidate recently had an interview on the topic of '{topic}'.
They struggled with the following weak concepts:
{weak_concepts}

Here is official documentation related to these concepts:
{formatted_context}

Based ONLY on the provided official documentation, create a structured, personalized learning plan to help them improve.
For each weak concept, provide a brief explanation based on the docs and actionable resources/steps to study.

Return your response in raw JSON format matching this schema:
{{
  "plan": [
    {{
      "concept": "<string: the weak concept name>",
      "explanation": "<string: brief explanation from documentation>",
      "resources": ["<string: actionable study step or resource>"]
    }}
  ]
}}

Do not include any markdown format tags like ```json or ``` in the response. Return raw JSON.
"""

    try:
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(prompt)
        text = response.text.strip()
        
        if text.startswith("```"):
            text = re.sub(r'^```(?:json)?\n|```$', '', text, flags=re.MULTILINE).strip()
            
        result = json.loads(text)
        return result
    except Exception as e:
        logger.error(f"Error generating learning plan: {e}")
        return {
            "plan": [
                {
                    "concept": concept,
                    "explanation": "Failed to generate detailed plan.",
                    "resources": [f"Review {topic} fundamentals"]
                } for concept in weak_concepts
            ]
        }
