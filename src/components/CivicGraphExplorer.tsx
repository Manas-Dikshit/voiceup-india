import React, { useEffect, useRef } from "react";
import * as d3 from "d3";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";

// Supabase client
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const COLORS: Record<string, string> = {
  user: "#06B6D4",
  problem: "#3B82F6",
  ministry: "#FACC15",
  solution: "#22C55E",
  location: "#9CA3AF",
};

interface GraphNode {
  id: string;
  type: string;
  label?: string;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface GraphEdge {
  source: string;
  target: string;
  strength?: number;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const CivicGraphExplorer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const nodesMapRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<GraphEdge[]>([]);

  useEffect(() => {
    if (!ref.current) return;

    const width = ref.current.offsetWidth || 800;
    const height = ref.current.offsetHeight || 600;

    const svg = d3
      .select(ref.current)
      .append("svg")
      .attr("width", width)
      .attr("height", height);

    const container = svg.append("g");

    // Zoom & pan
    svg.call(
      d3
        .zoom<SVGSVGElement, unknown>()
        .scaleExtent([0.2, 5])
        .on("zoom", (event) => {
          container.attr("transform", event.transform);
        })
    );

    // Force simulation
    const simulation = d3
      .forceSimulation<GraphNode>()
      .force("link", d3.forceLink<GraphNode, any>().id((d) => d.id).distance(120))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const updateGraph = (data: GraphData) => {
      nodesMapRef.current = new Map(data.nodes.map((n) => [n.id, n]));
      edgesRef.current = data.edges.map((e) => ({
        source: nodesMapRef.current.get(e.source)!,
        target: nodesMapRef.current.get(e.target)!,
        strength: e.strength,
      }));

      // Links
      const link = container
        .selectAll("line")
        .data(edgesRef.current, (d: any) => `${d.source.id}-${d.target.id}`);

      link.join("line")
        .attr("stroke", "#999")
        .attr("stroke-opacity", 0.6)
        .attr("stroke-width", (d: any) => (d.strength ? 2 + d.strength * 2 : 2));

      // Nodes
      const node = container
        .selectAll("circle")
        .data(Array.from(nodesMapRef.current.values()), (d: any) => d.id);

      node.join("circle")
        .attr("r", 20)
        .attr("fill", (d) => COLORS[d.type] || "#888")
        .call(
          d3
            .drag<SVGCircleElement, GraphNode>()
            .on("start", (event, d) => {
              if (!event.active) simulation.alphaTarget(0.3).restart();
              d.fx = d.x;
              d.fy = d.y;
            })
            .on("drag", (event, d) => {
              d.fx = event.x;
              d.fy = event.y;
            })
            .on("end", (event, d) => {
              if (!event.active) simulation.alphaTarget(0);
              d.fx = null;
              d.fy = null;
            })
        )
        .on("click", (_, d) => {
          alert(`Node: ${d.label || d.id}`);
        });

      // Labels
      const label = container
        .selectAll("text")
        .data(Array.from(nodesMapRef.current.values()), (d: any) => d.id);

      label.join("text")
        .text((d) => d.label)
        .attr("font-size", 12)
        .attr("fill", "#222");

      // Simulation tick
      simulation.nodes(Array.from(nodesMapRef.current.values()));
      (simulation.force("link") as any).links(edgesRef.current);
      simulation.alpha(1).restart();

      simulation.on("tick", () => {
        container.selectAll("line")
          .attr("x1", (d: any) => d.source.x!)
          .attr("y1", (d: any) => d.source.y!)
          .attr("x2", (d: any) => d.target.x!)
          .attr("y2", (d: any) => d.target.y!);

        container.selectAll("circle")
          .attr("cx", (d: any) => d.x!)
          .attr("cy", (d: any) => d.y!);

        container.selectAll("text")
          .attr("x", (d: any) => d.x! + 10)
          .attr("y", (d: any) => d.y! + 4);
      });
    };

    // Initial fetch
    const graphApiUrl = `${supabaseUrl}/functions/v1/graph-api`;
    fetch(graphApiUrl)
      .then((res) => res.json())
      .then(updateGraph)
      .catch(console.error);

    // Supabase Realtime subscription
    const problemSub = supabase
      .channel("realtime-graph")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problems" },
        () => fetch(graphApiUrl).then((res) => res.json()).then(updateGraph)
      )
      .subscribe();

    const relSub = supabase
      .channel("realtime-graph-rel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problem_relationships" },
        () => fetch(graphApiUrl).then((res) => res.json()).then(updateGraph)
      )
      .subscribe();

    return () => {
      supabase.removeChannel(problemSub);
      supabase.removeChannel(relSub);
    };
  }, []);

  return <Card className="p-4 w-full h-[600px]"><div ref={ref} style={{ width: "100%", height: "100%" }} /></Card>;
};

export default CivicGraphExplorer;
