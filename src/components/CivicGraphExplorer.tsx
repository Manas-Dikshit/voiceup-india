import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { createClient } from "@supabase/supabase-js";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

// Supabase setup
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

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
  source: GraphNode | string;
  target: GraphNode | string;
  strength?: number;
  type?: string;
}

interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const CivicGraphExplorer: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const nodesMapRef = useRef<Map<string, GraphNode>>(new Map());
  const edgesRef = useRef<GraphEdge[]>([]);
  const svgRef = useRef<any>(null);
  const zoomRef = useRef<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  useEffect(() => {
    if (!ref.current) return;

    const theme = document.documentElement.classList.contains("dark") ? "dark" : "light";

    const computedStyle = getComputedStyle(document.documentElement);
    
    // Improved color mapping with theme-aware colors
    const COLORS: Record<string, string> = {
      user: `hsl(${computedStyle.getPropertyValue("--info")})`,
      problem: `hsl(${computedStyle.getPropertyValue("--secondary")})`,
      ministry: `hsl(${computedStyle.getPropertyValue("--primary")})`,
      solution: `hsl(${computedStyle.getPropertyValue("--accent")})`,
      location: `hsl(${computedStyle.getPropertyValue("--muted-foreground")})`,
    };
    const LINK_COLOR = `hsl(${computedStyle.getPropertyValue("--border")})`;
    const TEXT_COLOR = `hsl(${computedStyle.getPropertyValue("--foreground")})`;
    const BG_COLOR = `hsl(${computedStyle.getPropertyValue("--background")})`;

    const containerEl = ref.current;
    const width = containerEl.offsetWidth;
    const height = containerEl.offsetHeight;

    // Remove existing SVG if present
    d3.select(containerEl).selectAll("svg").remove();

    const svg = d3
      .select(containerEl)
      .append("svg")
      .attr("width", "100%")
      .attr("height", "100%")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .style("cursor", "grab");

    svgRef.current = svg;

    const container = svg.append("g");

    // Define glow filter
    const defs = svg.append("defs");
    const filter = defs
      .append("filter")
      .attr("id", "nodeGlow")
      .attr("width", "300%")
      .attr("x", "-100%")
      .attr("height", "300%")
      .attr("y", "-100%");
    filter
      .append("feGaussianBlur")
      .attr("class", "blur")
      .attr("stdDeviation", "4")
      .attr("result", "coloredBlur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Enhanced Zoom & Pan with better UX
    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 5])
      .on("zoom", (event) => {
        container.attr("transform", event.transform);
      });
    
    zoomRef.current = zoom;
    svg.call(zoom);

    // Tooltip
    const tooltip = d3.select(tooltipRef.current);

    // Improved Simulation with better physics
    const simulation = d3
      .forceSimulation<GraphNode>()
      .force("link", d3.forceLink<GraphNode, any>()
        .id((d) => d.id)
        .distance((d: any) => {
          // Variable distance based on relationship strength
          return d.strength ? 100 + d.strength * 30 : 120;
        })
      )
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2))
      .force("collision", d3.forceCollide(45));

    const updateGraph = (data: GraphData) => {
      setIsLoading(false);
      
      // Validate data
      if (!data.nodes || !data.edges) {
        console.error("Invalid graph data received");
        return;
      }

      nodesMapRef.current = new Map(data.nodes.map((n) => [n.id, n]));
      edgesRef.current = data.edges
        .map((e) => ({
          source: nodesMapRef.current.get(typeof e.source === 'string' ? e.source : (e.source as any).id)!,
          target: nodesMapRef.current.get(typeof e.target === 'string' ? e.target : (e.target as any).id)!,
          strength: e.strength,
          type: e.type,
        }))
        .filter((e) => e.source && e.target) as any;

      // LINKS with improved styling
      const link = container
        .selectAll<SVGLineElement, any>("line")
        .data(edgesRef.current, (d: any) => `${d.source.id}-${d.target.id}`);

      link
        .join(
          (enter) =>
            enter
              .append("line")
              .attr("stroke", LINK_COLOR)
              .attr("stroke-opacity", 0.5)
              .attr("stroke-width", (d: any) =>
                d.strength ? 1 + d.strength * 1.5 : 1
              )
              .attr("stroke-dasharray", (d: any) =>
                d.type === "similar" ? "5,5" : "none"
              )
              .attr("class", "graph-link"),
          (update) => update
            .transition()
            .duration(300)
            .attr("stroke-opacity", 0.5)
            .attr("stroke-width", (d: any) =>
              d.strength ? 1 + d.strength * 1.5 : 1
            ),
          (exit) => exit
            .transition()
            .duration(200)
            .style("opacity", 0)
            .remove()
        );

      // NODES with improved interaction
      const node = container
        .selectAll<SVGCircleElement, GraphNode>("circle")
        .data(Array.from(nodesMapRef.current.values()), (d: any) => d.id);

      node
        .join(
          (enter) =>
            enter
              .append("circle")
              .attr("r", 22)
              .attr("fill", (d) => `url(#grad-${d.type})`)
              .style("stroke", TEXT_COLOR)
              .style("stroke-width", 2.2)
              .style("filter", "url(#nodeGlow)")
              .style("cursor", "pointer")
              .style("transition", "r 0.2s ease")
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
              .on("mouseover", (event, d) => {
                setHoveredNode(d.id);
                
                tooltip
                  .style("opacity", 1)
                  .html(
                    `<div class="font-semibold text-sm">${d.label || d.id}</div><div class="text-xs text-muted-foreground">Type: ${d.type}</div>`
                  )
                  .style("left", event.pageX + 10 + "px")
                  .style("top", event.pageY - 28 + "px");

                // Highlight connected nodes and edges
                container.selectAll("circle").style("opacity", (n: any) => 
                  n.id === d.id || 
                  edgesRef.current.some(e => {
                    const sourceId = typeof e.source === 'string' ? e.source : (e.source as any)?.id;
                    const targetId = typeof e.target === 'string' ? e.target : (e.target as any)?.id;
                    return (sourceId === d.id && targetId === n.id) ||
                           (targetId === d.id && sourceId === n.id);
                  }) ? 1 : 0.3
                );

                link
                  .style("stroke", (l: any) =>
                    l.source.id === d.id || l.target.id === d.id
                      ? COLORS[d.type]
                      : LINK_COLOR
                  )
                  .style("stroke-width", (l: any) =>
                    l.source.id === d.id || l.target.id === d.id ? 2.5 : 1
                  )
                  .style("stroke-opacity", (l: any) =>
                    l.source.id === d.id || l.target.id === d.id ? 0.9 : 0.3
                  );
              })
              .on("mousemove", (event) => {
                tooltip
                  .style("left", event.pageX + 10 + "px")
                  .style("top", event.pageY - 28 + "px");
              })
              .on("mouseout", () => {
                setHoveredNode(null);
                tooltip.style("opacity", 0);
                
                container.selectAll("circle").style("opacity", 1);
                link
                  .style("stroke", LINK_COLOR)
                  .style("stroke-width", (d: any) =>
                    d.strength ? 1 + d.strength * 1.5 : 1
                  )
                  .style("stroke-opacity", 0.5);
              }),
          (update) => update.transition().duration(300),
          (exit) => exit
            .transition()
            .duration(200)
            .attr("r", 0)
            .remove()
        );

      // GRADIENTS FOR NODES with improved colors
      const uniqueTypes = Array.from(new Set(data.nodes.map((n) => n.type)));
      uniqueTypes.forEach((type) => {
        if (!defs.select(`#grad-${type}`).empty()) {
          return;
        }
        const grad = defs
          .append("linearGradient")
          .attr("id", `grad-${type}`)
          .attr("x1", "0%")
          .attr("x2", "100%")
          .attr("y1", "0%")
          .attr("y2", "100%");
        grad
          .append("stop")
          .attr("offset", "0%")
          .attr("stop-color", COLORS[type])
          .attr("stop-opacity", 0.9);
        grad
          .append("stop")
          .attr("offset", "100%")
          .attr("stop-color", d3.color(COLORS[type])?.darker(0.8)?.toString() || COLORS[type])
          .attr("stop-opacity", 1);
      });

      // LABELS with better readability
      const label = container
        .selectAll<SVGTextElement, GraphNode>("text")
        .data(Array.from(nodesMapRef.current.values()), (d: any) => d.id);

      label
        .join(
          (enter) =>
            enter
              .append("text")
              .text((d) => d.label || d.id)
              .attr("font-size", 13)
              .attr("font-weight", 600)
              .attr("text-anchor", "middle")
              .attr("dy", 4)
              .attr("fill", TEXT_COLOR)
              .attr("paint-order", "stroke")
              .attr("stroke", BG_COLOR)
              .attr("stroke-width", 3)
              .attr("class", "pointer-events-none"),
          (update) => update
            .transition()
            .duration(300)
            .attr("text", (d) => d.label || d.id),
          (exit) => exit.remove()
        );

      simulation.nodes(Array.from(nodesMapRef.current.values()));
      (simulation.force("link") as any).links(edgesRef.current);
      simulation.alpha(1).restart();

      // Smooth animation on tick
      simulation.on("tick", () => {
        container
          .selectAll("line")
          .attr("x1", (d: any) => d.source.x!)
          .attr("y1", (d: any) => d.source.y!)
          .attr("x2", (d: any) => d.target.x!)
          .attr("y2", (d: any) => d.target.y!);

        container
          .selectAll("circle")
          .attr("cx", (d: any) => d.x!)
          .attr("cy", (d: any) => d.y!);

        container
          .selectAll("text")
          .attr("x", (d: any) => d.x!)
          .attr("y", (d: any) => d.y!);
      });
    };

    // Fetch initial graph data
    const graphApiUrl = `${supabaseUrl}/functions/v1/graph`;
    fetch(graphApiUrl)
      .then((res) => res.json())
      .then(updateGraph)
      .catch((err) => {
        console.error("Failed to fetch graph:", err);
        setIsLoading(false);
      });

    // Real-time subscriptions
    const problemSub = supabase
      .channel("realtime-graph")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problems" },
        () => fetch(graphApiUrl)
          .then((res) => res.json())
          .then(updateGraph)
          .catch(console.error)
      )
      .subscribe();

    const relSub = supabase
      .channel("realtime-graph-rel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "problem_relationships" },
        () => fetch(graphApiUrl)
          .then((res) => res.json())
          .then(updateGraph)
          .catch(console.error)
      )
      .subscribe();

    const handleResize = () => {
      const w = containerEl.offsetWidth;
      const h = containerEl.offsetHeight;
      svg.attr("viewBox", `0 0 ${w} ${h}`);
      simulation.force("center", d3.forceCenter(w / 2, h / 2));
      simulation.alpha(0.3).restart();
    };
    
    window.addEventListener("resize", handleResize);

    // Cleanup function
    return () => {
      supabase.removeChannel(problemSub);
      supabase.removeChannel(relSub);
      window.removeEventListener("resize", handleResize);
      if (svgRef.current) {
        svgRef.current.remove();
      }
    };
  }, []);

  // Control handlers
  const handleZoomIn = () => {
    if (svgRef.current && zoomRef.current) {
      svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 1.5);
    }
  };

  const handleZoomOut = () => {
    if (svgRef.current && zoomRef.current) {
      svgRef.current.transition().duration(300).call(zoomRef.current.scaleBy, 0.67);
    }
  };

  const handleReset = () => {
    if (svgRef.current && zoomRef.current) {
      const containerEl = ref.current;
      if (containerEl) {
        const width = containerEl.offsetWidth;
        const height = containerEl.offsetHeight;
        svgRef.current
          .transition()
          .duration(750)
          .call(
            zoomRef.current.transform,
            d3.zoomIdentity.translate(width / 2, height / 2)
          );
      }
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Header with Legend */}
      <Card className="p-4 bg-gradient-to-r from-card to-card/80 dark:from-card dark:to-card/60 backdrop-blur">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h3 className="text-lg font-bold text-card-foreground mb-2">Civic Knowledge Graph</h3>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-info"></div>
                <span className="text-muted-foreground">Users</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-secondary"></div>
                <span className="text-muted-foreground">Problems</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span className="text-muted-foreground">Ministry</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-accent"></div>
                <span className="text-muted-foreground">Solutions</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Graph Container */}
      <Card className="relative w-full h-[600px] sm:h-[700px] lg:h-[800px] bg-gradient-to-br from-card to-card/50 dark:from-card/50 dark:to-card/20 p-3 shadow-lg overflow-hidden border-border/50 group">
        {/* Loading State */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-card/80 dark:bg-card/60 backdrop-blur-sm z-50 rounded-lg">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading graph...</p>
            </div>
          </div>
        )}

        {/* Graph Container */}
        <div ref={ref} className="w-full h-full rounded-lg overflow-hidden bg-gradient-to-br from-background to-muted/10" />

        {/* Controls - Bottom Right */}
        <div className="absolute bottom-4 right-4 flex gap-2 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <Button
            variant="glass-primary"
            size="icon"
            onClick={handleZoomIn}
            title="Zoom in"
            className="h-9 w-9"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
          <Button
            variant="glass-primary"
            size="icon"
            onClick={handleZoomOut}
            title="Zoom out"
            className="h-9 w-9"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <Button
            variant="glass-primary"
            size="icon"
            onClick={handleReset}
            title="Reset view"
            className="h-9 w-9"
          >
            <RotateCcw className="w-4 h-4" />
          </Button>
        </div>

        {/* Info Text - Top Left */}
        <div className="absolute top-4 left-4 text-xs text-muted-foreground bg-card/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-border/30 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
          <p>Drag nodes • Scroll to zoom • Click controls to navigate</p>
        </div>
      </Card>

      {/* Tooltip */}
      <div
        ref={tooltipRef}
        className="fixed pointer-events-none px-3 py-2 text-sm bg-card dark:bg-card text-card-foreground rounded-lg shadow-lg border border-border/50 opacity-0 transition-opacity duration-150 backdrop-blur-sm z-50"
        style={{ position: "fixed" }}
      />
    </div>
  );
};

export default CivicGraphExplorer;