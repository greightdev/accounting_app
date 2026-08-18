import { useEffect, useState } from "react";
import { ChevronRight, ChevronDown, Pencil, Trash2 } from "lucide-react";

export default function TreeNode({
    node,
    level = 0,
    onEdit,
    onDelete,
    onEditGroup,
    onDeleteGroup,
    forceExpand = false
}) {
    const [expanded, setExpanded] = useState(true);
    
    useEffect(() => {
        if (forceExpand) setExpanded(true);
    }, [forceExpand]);
    
    // Account nodes (leaf)
    if (node.isAccount) {
        return (
            <div className="group flex items-center gap-4 py-1 pl-1 rounded hover:bg-gray-100">
                <div className="flex items-center gap-2">
                    <div className="w-4" />
                    <span className="text-slate-500">
                        {node.code ? `${node.code} ~ ` : ''}{node.name}
                    </span>
                </div>

                {!node.is_system && (onEdit || onDelete) && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {onEdit && (
                            <button
                                onClick={() => onEdit(node)}
                                className="flex items-center justify-center text-slate-500 hover:text-slate-800"
                                title="Edit"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                        {onDelete && (
                            <button
                                onClick={() => onDelete(node.id)}
                                className="flex items-center justify-center text-slate-500 hover:text-slate-800"
                                title="Delete"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // Group nodes
    const hasChildren = node.children?.length > 0;

    return (
        <div>
            <div className="group flex items-center gap-4 py-1 rounded hover:bg-gray-100">
                <div
                    className="flex items-center gap-2 cursor-pointer"
                    onClick={() => hasChildren && setExpanded((e) => !e)}
                >
                    {hasChildren ? (
                        expanded
                            ? <ChevronDown size={16} className="text-gray-500 shrink-0" />
                            : <ChevronRight size={16} className="text-gray-500 shrink-0" />
                        
                    ) : (
                        <div className="w-4 shrink-0" />
                    )}

                    <span className="font-semibold text-slate-800">
                        {node.code ? `${node.code} ~ ` : ''}{node.name}
                    </span>
                </div>

                {!node.is_system && (onEditGroup || onDeleteGroup) && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        {onEditGroup && (
                            <button
                                onClick={() => onEditGroup(node)}
                                className="flex items-center justify-center text-slate-500 hover:text-slate-800"
                                title="Edit Group"
                            >
                                <Pencil size={14} />
                            </button>
                        )}
                        {onDeleteGroup && (
                            <button
                                onClick={() => onDeleteGroup(node.id)}
                                className="flex items-center justify-center text-slate-500 hover:text-slate-800"
                                title="Delete Group"
                            >
                                <Trash2 size={14} />
                            </button>
                        )}
                    </div>
                )}
            </div>
            
            {hasChildren && expanded && (
                <div className="ml-2 border-l border-gray-300">
                    {node.children.map((child) => (
                        <div key={child.isAccount ? `acc-${child.id}` : `grp-${child.id}`} className="pl-4">
                            <TreeNode
                                node={child}
                                level={level + 1}
                                onEdit={onEdit}
                                onDelete={onDelete}
                                onEditGroup={onEditGroup}
                                onDeleteGroup={onDeleteGroup}
                                forceExpand={forceExpand}
                            />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}